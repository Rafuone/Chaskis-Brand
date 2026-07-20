// api/_lib/storage.js — couture de stockage d'objets (médias + événements analytics).
// CommonJS, AUCUNE dépendance npm : on parle DIRECTEMENT à l'API REST de Vercel Blob (le SDK
// @vercel/blob n'est qu'un emballage). C'est la condition pour rester host-agnostique : sur
// Azure, on remplacera l'adaptateur 'blob' par 'azure' (Blob Storage / Table) sans réécrire les
// appelants — même interface put/readUrl/list/del. Blob = banc d'essai TEMPORAIRE, pas le final.
//
// Fournisseur par ENV STORAGE_PROVIDER : 'blob' | 'memory' | 'off'.
//   - défaut = 'blob' si BLOB_READ_WRITE_TOKEN présent, sinon 'memory' (local/tests).
// Contrat REST Blob : PUT https://blob.vercel-storage.com/<pathname> (Bearer + x-content-type),
//   DELETE via POST /delete { urls:[...] }, LIST via GET ?prefix=&limit=. La version d'API est
//   surchargeable (BLOB_API_VERSION) : si Vercel la fait évoluer, c'est un réglage, pas du code.
// TOUT est fail-soft : jamais d'exception qui remonte (retour { ok:false, error } à la place).
'use strict';

var BLOB_HOST = 'https://blob.vercel-storage.com';

function token() { return (process.env.BLOB_READ_WRITE_TOKEN || '').trim(); }
function apiVersion() { return (process.env.BLOB_API_VERSION || '7').trim(); }

function provider() {
  var p = (process.env.STORAGE_PROVIDER || '').trim().toLowerCase();
  if (p === 'blob' || p === 'memory' || p === 'off') return p;
  return token() ? 'blob' : 'memory';
}

// Nettoyage d'une clé/chemin : slash autorisés (dossiers), pas de traversée `..`, pas de caractères
// douteux (on remplace par '-'), longueur bornée. Empêche l'échappement de l'espace de stockage.
function cleanKey(key) {
  var s = String(key == null ? '' : key).replace(/^\/+/, '');
  s = s.replace(/\.{2,}/g, '.').replace(/[^A-Za-z0-9._/\-]/g, '-').replace(/\/{2,}/g, '/');
  s = s.replace(/^\/+|\/+$/g, '');
  return s.slice(0, 300) || 'file';
}

function encodePath(key) { return key.split('/').map(encodeURIComponent).join('/'); }

var _mem = {}; // fournisseur mémoire : key -> { body, contentType, url, uploadedAt }

async function blobFetch(url, opts) {
  opts = opts || {};
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 9000);
  var headers = Object.assign({ 'authorization': 'Bearer ' + token(), 'x-api-version': apiVersion() }, opts.headers || {});
  try { return await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// Envoie un objet. body = Buffer | string | Uint8Array. options : { contentType, addRandomSuffix, cacheMaxAge }.
// Retour : { ok, url, downloadUrl, pathname, contentType } ou { ok:false, status, error }.
async function put(key, body, options) {
  options = options || {};
  key = cleanKey(key);
  var ct = options.contentType || 'application/octet-stream';
  if (provider() === 'memory') {
    var murl = 'memory://' + key;
    _mem[key] = { body: body, contentType: ct, url: murl, uploadedAt: new Date().toISOString() };
    return { ok: true, url: murl, downloadUrl: murl, pathname: key, contentType: ct };
  }
  if (provider() === 'off') return { ok: false, error: 'stockage désactivé (STORAGE_PROVIDER=off)' };
  if (!token()) return { ok: false, error: 'BLOB_READ_WRITE_TOKEN absent' };
  var headers = { 'x-content-type': ct, 'x-add-random-suffix': options.addRandomSuffix ? '1' : '0' };
  if (options.cacheMaxAge != null) headers['x-cache-control-max-age'] = String(options.cacheMaxAge);
  try {
    var r = await blobFetch(BLOB_HOST + '/' + encodePath(key), { method: 'PUT', headers: headers, body: body });
    var txt = await r.text(); var j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (!r.ok) return { ok: false, status: r.status, error: (j && j.error && (j.error.message || j.error)) || txt.slice(0, 300) || ('HTTP ' + r.status) };
    return { ok: true, url: j && j.url, downloadUrl: (j && (j.downloadUrl || j.url)), pathname: (j && j.pathname) || key, contentType: (j && j.contentType) || ct };
  } catch (e) { return { ok: false, error: (e && e.message) || 'échec upload' }; }
}

// Lit le contenu d'un objet public par son URL (aucune auth pour un store public).
// Retour : { ok, status, text, buffer } ou { ok:false }.
async function readUrl(url) {
  try {
    if (provider() === 'memory') {
      var k = String(url || '').replace(/^memory:\/\//, '');
      var m = _mem[k]; if (!m) return { ok: false, status: 404 };
      return { ok: true, status: 200, text: (typeof m.body === 'string' ? m.body : null), buffer: (typeof m.body !== 'string' ? m.body : null) };
    }
    var ctrl = new AbortController(); var t = setTimeout(function () { ctrl.abort(); }, 9000);
    try {
      var r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      var txt = await r.text();
      return { ok: r.ok, status: r.status, text: txt };
    } finally { clearTimeout(t); }
  } catch (e) { return { ok: false, error: (e && e.message) || 'lecture échouée' }; }
}

// Liste les objets (option prefix/limit). Retour : { ok, blobs:[{pathname,url,size,uploadedAt}], cursor, hasMore }.
async function list(prefix, limit) {
  if (provider() === 'memory') {
    var ks = Object.keys(_mem).filter(function (k) { return !prefix || k.indexOf(prefix) === 0; });
    return { ok: true, blobs: ks.map(function (k) { return { pathname: k, url: _mem[k].url, size: (_mem[k].body ? _mem[k].body.length : 0), uploadedAt: _mem[k].uploadedAt }; }) };
  }
  if (provider() === 'off') return { ok: false, error: 'stockage désactivé' };
  if (!token()) return { ok: false, error: 'BLOB_READ_WRITE_TOKEN absent' };
  try {
    var q = []; if (prefix) q.push('prefix=' + encodeURIComponent(prefix)); if (limit) q.push('limit=' + encodeURIComponent(limit));
    var r = await blobFetch(BLOB_HOST + '/' + (q.length ? ('?' + q.join('&')) : ''), { method: 'GET' });
    var txt = await r.text(); var j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (!r.ok) return { ok: false, status: r.status, error: txt.slice(0, 300) || ('HTTP ' + r.status) };
    return { ok: true, blobs: (j && j.blobs) || [], cursor: (j && j.cursor) || null, hasMore: !!(j && j.hasMore) };
  } catch (e) { return { ok: false, error: (e && e.message) || 'liste échouée' }; }
}

// Supprime un ou plusieurs objets par URL. Retour : { ok } ou { ok:false, status, error }.
async function del(urls) {
  var arr = Array.isArray(urls) ? urls : [urls];
  arr = arr.filter(Boolean);
  if (!arr.length) return { ok: true };
  if (provider() === 'memory') {
    arr.forEach(function (u) { Object.keys(_mem).forEach(function (k) { if (_mem[k].url === u || k === cleanKey(u)) delete _mem[k]; }); });
    return { ok: true };
  }
  if (provider() === 'off') return { ok: false, error: 'stockage désactivé' };
  if (!token()) return { ok: false, error: 'BLOB_READ_WRITE_TOKEN absent' };
  try {
    var r = await blobFetch(BLOB_HOST + '/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls: arr }) });
    if (!r.ok) { var txt = await r.text(); return { ok: false, status: r.status, error: txt.slice(0, 300) || ('HTTP ' + r.status) }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || 'suppression échouée' }; }
}

function configured() { return provider() === 'memory' || (provider() === 'blob' && !!token()); }
function _resetMemory() { _mem = {}; }

module.exports = {
  provider: provider, put: put, readUrl: readUrl, list: list, del: del,
  cleanKey: cleanKey, configured: configured, BLOB_HOST: BLOB_HOST, _resetMemory: _resetMemory,
};

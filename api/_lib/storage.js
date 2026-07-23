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
  if (p === 'blob' || p === 'azure' || p === 'memory' || p === 'off') return p;
  if (azureSasUrl() && !token()) return 'azure';
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

// ===== Adaptateur AZURE Blob Storage (cible finale d'hébergement) =====
// Activé par STORAGE_PROVIDER=azure (ou auto : si AZURE_BLOB_SAS_URL est présent et qu'aucun
// token Vercel ne l'est). Config d'UNE seule variable :
//   AZURE_BLOB_SAS_URL = URL du conteneur AVEC jeton SAS, ex.
//   https://<compte>.blob.core.windows.net/<conteneur>?sv=...&ss=b&srt=co&sp=racwdl&sig=...
// Recommandation : conteneur médias en accès lecture publique au niveau blob (les URL d'images
// servies au site fonctionnent alors sans SAS) ; écritures / suppressions / listes utilisent le SAS.
// Contrat REST Azure conforme (x-ms-blob-type, comp=list, x-ms-version) et couvert par des tests
// simulés — À VALIDER contre un vrai compte Azure lors de l'intégration.
var AZ_VERSION = '2021-08-06';
function azureSasUrl() { return (process.env.AZURE_BLOB_SAS_URL || '').trim(); }
function azureParts() { var u = azureSasUrl(); var i = u.indexOf('?'); return i < 0 ? { base: u.replace(/\/+$/, ''), sas: '' } : { base: u.slice(0, i).replace(/\/+$/, ''), sas: u.slice(i + 1) }; }
function azureBlobUrl(key) { return azureParts().base + '/' + encodePath(key); }
function azureAuthed(url) { var sas = azureParts().sas; if (!sas) return url; return url + (url.indexOf('?') < 0 ? '?' : '&') + sas; }
function azureRandomKey(key) { try { var suf = require('crypto').randomBytes(6).toString('hex'); var dot = key.lastIndexOf('.'); return dot > 0 ? key.slice(0, dot) + '-' + suf + key.slice(dot) : key + '-' + suf; } catch (e) { return key; } }
async function azureFetch(url, opts) {
  opts = opts || {};
  var ctrl = new AbortController(); var t = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 9000);
  var headers = Object.assign({ 'x-ms-version': AZ_VERSION }, opts.headers || {});
  try { return await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
async function azurePut(key, body, options, ct) {
  if (!azureSasUrl()) return { ok: false, error: 'AZURE_BLOB_SAS_URL absent' };
  if (options.addRandomSuffix) key = azureRandomKey(key);
  var publicUrl = azureBlobUrl(key);
  var headers = { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': ct };
  if (options.cacheMaxAge != null) headers['x-ms-blob-cache-control'] = 'public, max-age=' + options.cacheMaxAge;
  try {
    var r = await azureFetch(azureAuthed(publicUrl), { method: 'PUT', headers: headers, body: body });
    if (!r.ok) { var txt = await r.text(); return { ok: false, status: r.status, error: txt.slice(0, 300) || ('HTTP ' + r.status) }; }
    return { ok: true, url: publicUrl, downloadUrl: publicUrl, pathname: key, contentType: ct };
  } catch (e) { return { ok: false, error: (e && e.message) || 'échec upload Azure' }; }
}
async function azureList(prefix, limit, cursor) {
  if (!azureSasUrl()) return { ok: false, error: 'AZURE_BLOB_SAS_URL absent' };
  var parts = azureParts();
  var q = 'restype=container&comp=list';
  if (prefix) q += '&prefix=' + encodeURIComponent(prefix);
  if (limit) q += '&maxresults=' + encodeURIComponent(limit);
  if (cursor) q += '&marker=' + encodeURIComponent(cursor);
  try {
    var r = await azureFetch(parts.base + '?' + q + (parts.sas ? '&' + parts.sas : ''), { method: 'GET' });
    var xml = await r.text();
    if (!r.ok) return { ok: false, status: r.status, error: xml.slice(0, 300) || ('HTTP ' + r.status) };
    var blobs = [], re = /<Blob>([\s\S]*?)<\/Blob>/g, m;
    while ((m = re.exec(xml))) {
      var seg = m[1];
      var name = (seg.match(/<Name>([\s\S]*?)<\/Name>/) || [])[1] || '';
      var size = (seg.match(/<Content-Length>([\s\S]*?)<\/Content-Length>/) || [])[1] || '0';
      var mod = (seg.match(/<Last-Modified>([\s\S]*?)<\/Last-Modified>/) || [])[1] || '';
      if (name) blobs.push({ pathname: name, url: azureBlobUrl(name), size: parseInt(size, 10) || 0, uploadedAt: mod ? new Date(mod).toISOString() : null });
    }
    var next = (xml.match(/<NextMarker>([\s\S]*?)<\/NextMarker>/) || [])[1] || '';
    return { ok: true, blobs: blobs, cursor: next || null, hasMore: !!next };
  } catch (e) { return { ok: false, error: (e && e.message) || 'liste Azure échouée' }; }
}
async function azureDel(arr) {
  if (!azureSasUrl()) return { ok: false, error: 'AZURE_BLOB_SAS_URL absent' };
  try {
    for (var i = 0; i < arr.length; i++) {
      var r = await azureFetch(azureAuthed(String(arr[i]).split('?')[0]), { method: 'DELETE' });
      if (!r.ok && r.status !== 404 && r.status !== 202) { var txt = await r.text(); return { ok: false, status: r.status, error: txt.slice(0, 200) || ('HTTP ' + r.status) }; }
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || 'suppression Azure échouée' }; }
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
  if (provider() === 'azure') return azurePut(key, body, options, ct);
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
    var target = (provider() === 'azure') ? azureAuthed(url) : url;
    var ctrl = new AbortController(); var t = setTimeout(function () { ctrl.abort(); }, 9000);
    try {
      var r = await fetch(target, { cache: 'no-store', signal: ctrl.signal });
      var txt = await r.text();
      return { ok: r.ok, status: r.status, text: txt };
    } finally { clearTimeout(t); }
  } catch (e) { return { ok: false, error: (e && e.message) || 'lecture échouée' }; }
}

// Liste les objets (option prefix/limit). Retour : { ok, blobs:[{pathname,url,size,uploadedAt}], cursor, hasMore }.
async function list(prefix, limit, cursor) {
  if (provider() === 'memory') {
    var ks = Object.keys(_mem).filter(function (k) { return !prefix || k.indexOf(prefix) === 0; });
    return { ok: true, blobs: ks.map(function (k) { return { pathname: k, url: _mem[k].url, size: (_mem[k].body ? _mem[k].body.length : 0), uploadedAt: _mem[k].uploadedAt }; }), cursor: null, hasMore: false };
  }
  if (provider() === 'off') return { ok: false, error: 'stockage désactivé' };
  if (provider() === 'azure') return azureList(prefix, limit, cursor);
  if (!token()) return { ok: false, error: 'BLOB_READ_WRITE_TOKEN absent' };
  try {
    var q = []; if (prefix) q.push('prefix=' + encodeURIComponent(prefix)); if (limit) q.push('limit=' + encodeURIComponent(limit)); if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
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
  if (provider() === 'azure') return azureDel(arr);
  if (!token()) return { ok: false, error: 'BLOB_READ_WRITE_TOKEN absent' };
  try {
    var r = await blobFetch(BLOB_HOST + '/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls: arr }) });
    if (!r.ok) { var txt = await r.text(); return { ok: false, status: r.status, error: txt.slice(0, 300) || ('HTTP ' + r.status) }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || 'suppression échouée' }; }
}

function configured() { return provider() === 'memory' || (provider() === 'blob' && !!token()) || (provider() === 'azure' && !!azureSasUrl()); }
function _resetMemory() { _mem = {}; }

module.exports = {
  provider: provider, put: put, readUrl: readUrl, list: list, del: del,
  cleanKey: cleanKey, configured: configured, BLOB_HOST: BLOB_HOST, _resetMemory: _resetMemory,
};

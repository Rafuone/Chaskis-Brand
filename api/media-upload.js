// api/media-upload.js — upload d'un média (image) vers le stockage réel (Vercel Blob via la
// couture api/_lib/storage.js). POST, capacité media.import. Reçoit un fichier encodé en base64,
// le valide (type + taille), l'écrit dans le store, renvoie l'URL publique persistante.
//
// Remplace le stockage dataURL/localStorage de l'éditeur : les médias deviennent de vrais
// fichiers, partagés entre appareils/admins, référençables par URL dans le contenu publié.
// Host-agnostique : aucune dépendance, l'écriture passe par storage.put (swap Azure trivial).
'use strict';

var { send, readJson } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');
var storage = require('./_lib/storage');

var ALLOWED = ['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml'];
var MAX_BYTES = 2 * 1024 * 1024; // 2 Mo (même plafond que l'éditeur ; < limite Vercel 4,5 Mo/requête)
var EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };

// Validation PURE (testable). Retourne { ok:true, buffer, contentType, key } ou { ok:false, error }.
function validateUpload(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'corps invalide' };
  var ct = String(body.contentType || '').toLowerCase().split(';')[0].trim();
  if (ALLOWED.indexOf(ct) < 0) return { ok: false, error: 'type non autorisé (WebP, PNG, JPEG, SVG)' };
  var b64 = String(body.dataBase64 || '');
  // tolère un préfixe dataURL "data:...;base64,"
  var comma = b64.indexOf('base64,'); if (comma >= 0) b64 = b64.slice(comma + 7);
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(b64) || b64.length < 8) return { ok: false, error: 'contenu base64 invalide' };
  var buf; try { buf = Buffer.from(b64, 'base64'); } catch (e) { return { ok: false, error: 'décodage base64 impossible' }; }
  if (!buf || !buf.length) return { ok: false, error: 'fichier vide' };
  if (buf.length > MAX_BYTES) return { ok: false, error: 'fichier trop lourd (max 2 Mo)' };
  // SVG : refus du contenu ACTIF (un SVG servi depuis l'origine Blob peut exécuter du JS si ouvert
  // en direct = XSS stocké). On rejette script / gestionnaires on* / javascript: / foreignObject
  // plutôt que d'assainir (fail-closed, l'éditeur corrige et ré-importe un SVG propre).
  if (ct === 'image/svg+xml') {
    var svg = buf.toString('utf8');
    if (/<script[\s>]/i.test(svg) || /\son[a-z]+\s*=/i.test(svg) || /javascript:/i.test(svg) || /<foreignObject[\s>]/i.test(svg)) {
      return { ok: false, error: 'SVG refusé : contient du contenu actif (script/handlers). Exportez un SVG « aplati » sans script.' };
    }
  }
  var base = storage.cleanKey((body.filename || 'media').replace(/\.[^.]+$/, '')).replace(/\//g, '-').slice(0, 80) || 'media';
  var key = 'media/' + base + '.' + (EXT[ct] || 'bin');
  return { ok: true, buffer: buf, contentType: ct, key: key };
}

// GET = diagnostic du stockage (aller-retour réel put -> lecture -> del). Ne révèle aucun secret
// (noms de variables présentes uniquement). Utile pour prouver/déboguer le stockage sans le SDK.
async function diagnostic(res) {
  var env = {};
  ['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'BLOB_WEBHOOK_PUBLIC_KEY', 'VERCEL_OIDC_TOKEN', 'STORAGE_PROVIDER', 'BLOB_API_VERSION']
    .forEach(function (k) { env[k] = !!(process.env[k] && String(process.env[k]).trim()); });
  var blobVarNames = Object.keys(process.env).filter(function (k) { return /BLOB|VERCEL_OIDC/i.test(k); }).sort();
  var report = { provider: storage.provider(), env: env, blobVarNames: blobVarNames, steps: {} };
  try {
    var key = 'diagnostic/media-check-' + Date.now() + '.txt';
    var payload = 'chaskis storage check ' + new Date().toISOString();
    var p = await storage.put(key, payload, { contentType: 'text/plain; charset=utf-8', addRandomSuffix: true });
    report.steps.put = { ok: p.ok, status: p.status, error: p.error };
    if (p.ok) {
      report.steps.put.isPublicUrl = /\.public\.blob\.vercel-storage\.com/.test(p.url || '');
      var rr = await storage.readUrl(p.url);
      report.steps.read = { ok: !!(rr.ok && rr.text === payload), status: rr.status };
      var d = await storage.del(p.url);
      report.steps.del = { ok: d.ok, status: d.status, error: d.error };
    }
    report.ok = !!(report.steps.put && report.steps.put.ok && report.steps.read && report.steps.read.ok && report.steps.del && report.steps.del.ok);
    if (report.provider !== 'blob') report.warning = "Stockage Blob inactif (BLOB_READ_WRITE_TOKEN absent) — repli mémoire utilisé.";
  } catch (e) { report.ok = false; report.error = (e && e.message) || String(e); }
  return send(res, 200, report);
}

async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });

  var auth = await requireAuth(req);
  if (!auth) return send(res, 401, { error: 'non autorisé' });
  if (!can('media.import', auth)) return send(res, 403, { error: 'accès refusé', need: 'media.import' });

  if (req.method === 'GET') return diagnostic(res);

  var body = await readJson(req, 6 * 1024 * 1024, 'média trop volumineux (max ~4 Mo encodé)');
  if (body && body.__error) return send(res, 400, { error: body.__error });

  var v = validateUpload(body);
  if (!v.ok) return send(res, 400, { error: v.error });

  var r = await storage.put(v.key, v.buffer, { contentType: v.contentType, addRandomSuffix: true, cacheMaxAge: 31536000 });
  if (!r.ok) {
    // Message GÉNÉRIQUE côté client (ne pas relayer le corps d'erreur amont du stockage) ; le
    // détail reste côté serveur pour le diagnostic.
    try { console.error('media-upload: échec stockage', r.status, r.error); } catch (e) {}
    return send(res, (r.status && r.status >= 400 && r.status < 500) ? r.status : 502, { error: 'stockage du média indisponible', provider: storage.provider() });
  }

  return send(res, 200, { ok: true, url: r.url, pathname: r.pathname, size: v.buffer.length, contentType: v.contentType });
}

module.exports = handler;
module.exports.validateUpload = validateUpload;
module.exports.ALLOWED = ALLOWED;
module.exports.MAX_BYTES = MAX_BYTES;

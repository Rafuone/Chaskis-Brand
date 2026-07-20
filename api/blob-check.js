// api/blob-check.js — DIAGNOSTIC du stockage (Vercel Blob) : aller-retour réel put -> lecture -> del.
// But : prouver que le stockage est VRAIMENT utilisable avant de construire médias/analytics dessus.
// Gated admin (capacité media.import). Ne révèle JAMAIS de secret : seulement les NOMS de variables
// présentes (booléens) + le résultat de chaque étape. Écrit puis supprime un petit fichier de test.
'use strict';

var { send } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');
var storage = require('./_lib/storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: 'méthode non autorisée' });

  var auth = await requireAuth(req);
  if (!auth) return send(res, 401, { error: 'non autorisé' });
  if (!can('media.import', auth)) return send(res, 403, { error: 'accès refusé', need: 'media.import' });

  // Présence des variables d'environnement (NOMS seulement, jamais les valeurs).
  var env = {};
  ['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'BLOB_WEBHOOK_PUBLIC_KEY', 'VERCEL_OIDC_TOKEN', 'STORAGE_PROVIDER', 'BLOB_API_VERSION']
    .forEach(function (k) { env[k] = !!(process.env[k] && String(process.env[k]).trim()); });
  // NOMS (jamais les valeurs) des variables liées au stockage réellement présentes — utile si le
  // token a été ajouté sous un préfixe (ex. MEDIA_BLOB_READ_WRITE_TOKEN) ou en OIDC.
  var blobVarNames = Object.keys(process.env).filter(function (k) { return /BLOB|VERCEL_OIDC/i.test(k); }).sort();

  var report = { provider: storage.provider(), env: env, blobVarNames: blobVarNames, steps: {} };

  try {
    var key = 'diagnostic/blob-check-' + Date.now() + '.txt';
    var payload = 'chaskis blob check ' + new Date().toISOString();

    var p = await storage.put(key, payload, { contentType: 'text/plain; charset=utf-8', addRandomSuffix: true });
    report.steps.put = { ok: p.ok, status: p.status, error: p.error };
    if (p.ok) {
      report.steps.put.isPublicUrl = /\.public\.blob\.vercel-storage\.com/.test(p.url || '');
      var rr = await storage.readUrl(p.url);
      report.steps.read = { ok: !!(rr.ok && rr.text === payload), status: rr.status, matches: rr.text === payload };
      var d = await storage.del(p.url);
      report.steps.del = { ok: d.ok, status: d.status, error: d.error };
    }
    report.ok = !!(report.steps.put && report.steps.put.ok &&
      report.steps.read && report.steps.read.ok &&
      report.steps.del && report.steps.del.ok);
    if (report.provider === 'blob' && report.steps.put && report.steps.put.ok && report.steps.put.isPublicUrl === false) {
      report.warning = "Le store n'est pas PUBLIC : les médias ne seront pas lisibles dans les <img>. Recréez le store en accès Public.";
    }
    if (report.provider !== 'blob') {
      report.warning = "Le vrai stockage Blob n'est pas actif (BLOB_READ_WRITE_TOKEN absent) — l'aller-retour ci-dessus a utilisé le repli mémoire, PAS Vercel Blob.";
    }
  } catch (e) {
    report.ok = false; report.error = (e && e.message) || String(e);
  }

  return send(res, 200, report);
};

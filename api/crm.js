// api/crm.js — DEMANDES COMMERCIALES (leads) reçues du site public. Host-agnostique.
//
// Le formulaire public « Commander » ne partait NULLE PART : la demande restait dans le
// localStorage du visiteur (invisible aux commerciaux). Ici on la capture côté serveur pour que
// l'admin la retrouve. (Le lot suivant ajoutera le registre CLIENTS sur le même endpoint.)
//
//   POST /api/crm            (PUBLIC) : enregistre une demande. Corps { company, contact, email, phone, summary }.
//   GET  /api/crm?days=60    (capacité clients.view) : liste les demandes récentes (plus récente en tête).
//
// STOCKAGE (couture api/_lib/storage.js) : 1 demande = 1 objet Blob `leads/<jour>/<aléa>`, CORPS =
// JSON de la demande. Listing PAR JOUR (fenêtre bornée), lecture des corps par petits lots.
//   nLPD : le store Blob de test est PUBLIC, mais (a) l'URL porte un suffixe aléatoire non
//   devinable, (b) elle n'est JAMAIS renvoyée au visiteur (seul l'admin la lit via le token de
//   listing), (c) champs BORNÉS (minimisation). Sur l'hôte final (Azure), pointer storage.js vers
//   un store PRIVÉ (Blob privé / Table) — la couture le permet sans toucher cet endpoint.
//
// ANTI-ABUS : POST public -> filtre anti-bots (UA) + rate-limit best-effort mémoire (par instance) ;
// la protection DURE (flood distribué) relève de la couche hôte (Vercel Firewall / Azure Front Door),
// comme api/collect.js.
'use strict';

var crypto = require('crypto');
var { send, readJson } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');
var storage = require('./_lib/storage');

var PREFIX = 'leads/';
var MAX_LIST_CALLS = 30;   // borne d'appels list par agrégation (coût + timeout)
var MAX_LEADS = 200;       // plafond de demandes renvoyées au panneau admin
var READ_BATCH = 10;       // lectures de corps en parallèle par lot
var RL_MAX = 20;           // demandes/min/IP (best-effort) — un vrai formulaire en produit très peu
var BOT_RE = /(bot|crawl|spider|slurp|headless|phantom|curl|wget|python-requests|node-fetch|axios|monitor|preview)/i;

function dayKey(d) { return d.toISOString().slice(0, 10); } // YYYY-MM-DD (UTC)

// IP client : en-têtes POSÉS PAR LA PLATEFORME d'abord (non falsifiables), comme api/collect.js.
function clientIp(req) {
  var h = (req && req.headers) || {};
  if (h['x-real-ip']) return String(h['x-real-ip']).trim();
  if (h['x-vercel-forwarded-for']) return String(h['x-vercel-forwarded-for']).split(',')[0].trim();
  var xf = (h['x-forwarded-for'] || '').split(',');
  return (xf[xf.length - 1] || '').trim();
}

var _rl = new Map();
function rateLimited(ip) {
  if (!ip) return false;
  var win = Math.floor(Date.now() / 60000);
  var e = _rl.get(ip);
  if (!e || e.w !== win) { e = { c: 0, w: win }; _rl.set(ip, e); }
  e.c++;
  if (_rl.size > 5000) { _rl.forEach(function (v, k) { if (v.w !== win) _rl.delete(k); }); }
  return e.c > RL_MAX;
}

// Nettoie + borne un champ texte (une ligne). Minimisation nLPD + protège le stockage.
function clip(v, n) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, n); }

// Objet demande borné, à partir d'un corps non fiable. Retour null si aucun moyen de recontact.
function leadFromBody(body) {
  body = body || {};
  var email = clip(body.email, 120), phone = clip(body.phone, 40);
  if (!email && !phone) return null;               // sans email NI téléphone : aucune valeur commerciale
  return {
    company: clip(body.company, 80),
    contact: clip(body.contact, 80),
    email: email,
    phone: phone,
    summary: clip(body.summary, 200),
    source: clip(body.source, 24) || 'commander',
  };
}

async function collectLead(req, res) {
  var ua = (((req && req.headers) || {})['user-agent'] || '');
  if (BOT_RE.test(ua)) return send(res, 200, { ok: true, saved: false, reason: 'bot' });
  var ip = clientIp(req);
  if (rateLimited(ip)) return send(res, 429, { ok: false, error: 'trop de demandes, réessayez dans un instant' });

  var body = await readJson(req, 16 * 1024, 'charge trop volumineuse');
  if (body && body.__error) return send(res, 400, { error: body.__error });

  var lead = leadFromBody(body);
  if (!lead) return send(res, 400, { error: 'email ou téléphone requis' });

  var now = new Date();
  lead.receivedAt = now.toISOString();
  var key = PREFIX + dayKey(now) + '/' + crypto.randomBytes(9).toString('hex');
  var r = await storage.put(key, JSON.stringify(lead), { contentType: 'application/json', addRandomSuffix: true });
  if (!r.ok) return send(res, 200, { ok: false, saved: false, error: r.error || 'stockage indisponible' });
  return send(res, 200, { ok: true, saved: true });
}

async function listLeads(req, res) {
  var m = /[?&]days=(\d{1,3})/.exec((req && req.url) || '');
  var days = m ? Math.min(120, Math.max(1, parseInt(m[1], 10))) : 60;

  // 1) Collecte des références (listing PAR JOUR, du plus récent au plus ancien). Aucune lecture de corps.
  var refs = [], calls = 0, anyOk = false, truncated = false;
  for (var i = 0; i < days && refs.length < MAX_LEADS; i++) {
    if (calls >= MAX_LIST_CALLS) { truncated = true; break; }
    var d = dayKey(new Date(Date.now() - i * 86400000));
    var cursor = null, guard = 0;
    do {
      var r = await storage.list(PREFIX + d + '/', 1000, cursor); calls++;
      if (!r || !r.ok) break;
      anyOk = true;
      (r.blobs || []).forEach(function (b) { refs.push({ url: b.url, at: b.uploadedAt || '' }); });
      cursor = (r.hasMore && r.cursor) ? r.cursor : null; guard++;
    } while (cursor && calls < MAX_LIST_CALLS && guard < 20);
  }
  if (!anyOk) return send(res, 200, { ok: true, provider: storage.provider(), note: 'stockage indisponible', leads: [] });

  // 2) Plus récentes d'abord, plafonnées, puis lecture des corps par petits lots parallèles.
  refs.sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
  if (refs.length > MAX_LEADS) refs = refs.slice(0, MAX_LEADS);
  var leads = [];
  for (var j = 0; j < refs.length; j += READ_BATCH) {
    var batch = refs.slice(j, j + READ_BATCH);
    var bodies = await Promise.all(batch.map(function (x) { return storage.readUrl(x.url); }));
    bodies.forEach(function (rr, idx) {
      if (rr && rr.ok && rr.text) {
        try { var o = JSON.parse(rr.text); if (o && typeof o === 'object') { if (!o.receivedAt) o.receivedAt = batch[idx].at; leads.push(o); } } catch (e) {}
      }
    });
  }
  leads.sort(function (a, b) { return String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')); });
  return send(res, 200, { ok: true, provider: storage.provider(), count: leads.length, truncated: truncated, leads: leads });
}

module.exports = async function handler(req, res) {
  if (req.method === 'POST') return collectLead(req, res);
  if (req.method === 'GET') {
    var auth = await requireAuth(req);
    if (!auth) return send(res, 401, { error: 'non autorisé' });
    if (!can('clients.view', auth)) return send(res, 403, { error: 'accès refusé', need: 'clients.view' });
    return listLeads(req, res);
  }
  return send(res, 405, { error: 'méthode non autorisée' });
};

// Exposés pour les tests.
module.exports.leadFromBody = leadFromBody;
module.exports.BOT_RE = BOT_RE;

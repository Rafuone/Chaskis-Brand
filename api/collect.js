// api/collect.js — collecteur d'audience MAISON, sans cookie, host-agnostique (chantier analytics).
// Remplace la lecture des stats Umami (API Pro payante) : on collecte nous-memes et on affiche
// dans l'admin. Stockage via la couture storage.js (Vercel Blob aujourd'hui -> Azure demain).
//
//   POST /api/collect            (PUBLIC) : enregistre une page vue. Corps { p, r, l, w }.
//   GET  /api/collect?days=30    (capacite stats.view) : agrege et renvoie les stats.
//
// MODELE DE STOCKAGE — append-only SANS perte : 1 evenement = 1 objet Blob dont la CLE encode
// l'evenement en base64url : `analytics/ev/<jour>/<base64url(JSON)>.<alea hex>`. L'agregation se
// fait par LISTING des cles (aucune lecture de corps) => pas de course/perte, pas de timeout.
// Visiteur unique = hash(IP + User-Agent + sel du JOUR) tronque : anonyme, RGPD-friendly, rotation
// quotidienne (aucun suivi inter-jours), meme methode qu'Umami. Filtre anti-bots (User-Agent).
// SCALE : a fort trafic, basculer le stockage vers Azure Table/App Insights (meme couture) ; ici
// (vitrine, faible trafic de test) le listing borne suffit. Retention = purge future des vieux jours.
'use strict';

var crypto = require('crypto');
var { send, readJson } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');
var storage = require('./_lib/storage');

var PREFIX = 'analytics/ev/';
var MAX_PAGES = 12;        // borne de securite du listing (12 x 1000 = 12k evenements/agregation max)
var BOT_RE = /(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|slackbot|vkshare|whatsapp|telegram|discord|headless|phantom|lighthouse|pagespeed|gtmetrix|pingdom|uptime|curl|wget|python-requests|node-fetch|axios|monitor|preview)/i;

function dayKey(d) { return d.toISOString().slice(0, 10); } // YYYY-MM-DD (UTC)
function clientIp(req) {
  var h = (req && req.headers) || {};
  var xf = (h['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || h['x-real-ip'] || h['x-vercel-forwarded-for'] || '';
}
// Empreinte visiteur du jour : non reversible, rotative (sel = jour + secret serveur).
function visitorHash(ip, ua, day) {
  var salt = (process.env.ANALYTICS_SALT || process.env.PING_TOKEN || 'chaskis-analytics') + '|' + day;
  return crypto.createHash('sha256').update(salt + '|' + (ip || '') + '|' + (ua || '')).digest('hex').slice(0, 12);
}
function b64urlEncode(s) { return Buffer.from(s, 'utf8').toString('base64url'); }
function b64urlDecode(s) { try { return Buffer.from(s, 'base64url').toString('utf8'); } catch (e) { return ''; } }

function sanitizePath(p) {
  p = String(p || '/').split('?')[0].split('#')[0];
  if (p.length > 120) p = p.slice(0, 120);
  return p || '/';
}
function sanitizeRef(r) {
  // On ne garde que l'hôte (referrer = domaine source) : couper à un éventuel chemin, puis chars sûrs.
  r = String(r || '').toLowerCase().split('/')[0].replace(/[^a-z0-9.\-]/g, '').slice(0, 80);
  return r;
}

async function collect(req, res) {
  var body = await readJson(req, 8 * 1024, 'charge trop volumineuse');
  if (body && body.__error) return send(res, 400, { error: body.__error });
  var ua = (((req && req.headers) || {})['user-agent'] || '');
  // Bots : on repond 200 mais on NE compte PAS (comme les analytics matures). Le collecteur
  // etant du JS cote navigateur, la plupart des robots ne l'executent deja pas.
  if (BOT_RE.test(ua)) return send(res, 200, { ok: true, counted: false, reason: 'bot' });

  var now = new Date();
  var day = dayKey(now);
  var ev = {
    t: now.getTime(),
    p: sanitizePath(body && body.p),
    r: sanitizeRef(body && body.r),
    l: String((body && body.l) || '').slice(0, 2),
    v: visitorHash(clientIp(req), ua, day),
  };
  var key = PREFIX + day + '/' + b64urlEncode(JSON.stringify(ev)) + '.' + crypto.randomBytes(6).toString('hex');
  var r = await storage.put(key, '1', { contentType: 'text/plain', addRandomSuffix: false });
  if (!r.ok) return send(res, 200, { ok: false, counted: false, error: r.error || 'stockage indisponible' });
  return send(res, 200, { ok: true, counted: true });
}

// Décode un événement depuis une clé Blob : `analytics/ev/<jour>/<b64url>.<hex>`.
function eventFromPathname(pathname) {
  try {
    var seg = String(pathname).split('/').pop();      // <b64url>.<hex>
    var b64 = seg.split('.')[0];                       // b64url (aucun '.' dedans)
    var json = b64urlDecode(b64);
    var ev = JSON.parse(json);
    if (ev && typeof ev === 'object' && ev.p) return ev;
  } catch (e) {}
  return null;
}

async function stats(req, res) {
  var url = (req && req.url) || '';
  var m = /[?&]days=(\d{1,3})/.exec(url);
  var days = m ? Math.min(365, Math.max(1, parseInt(m[1], 10))) : 30;
  var since = Date.now() - days * 86400000;

  // Listing pagine des cles (aucune lecture de corps) — on suit le cursor jusqu'a MAX_PAGES.
  var events = [], cursor = null, pages = 0, truncated = false;
  while (pages < MAX_PAGES) {
    var r = await storage.list(PREFIX, 1000, cursor);
    if (!r || !r.ok) { if (pages === 0) return send(res, 200, { ok: true, provider: storage.provider(), note: 'aucune donnee', totals: { pageviews: 0, visitors: 0 }, daily: [], topPages: [], topRefs: [] }); break; }
    (r.blobs || []).forEach(function (b) { var ev = eventFromPathname(b.pathname); if (ev && ev.t >= since) events.push(ev); });
    pages++;
    if (r.hasMore && r.cursor) { cursor = r.cursor; if (pages >= MAX_PAGES) { truncated = true; break; } }
    else break;
  }

  // Agregation.
  var byDay = {}, pageCount = {}, refCount = {}, visitorsAll = {};
  events.forEach(function (ev) {
    var d = dayKey(new Date(ev.t));
    if (!byDay[d]) byDay[d] = { day: d, views: 0, vis: {} };
    byDay[d].views++; byDay[d].vis[ev.v] = 1;
    pageCount[ev.p] = (pageCount[ev.p] || 0) + 1;
    if (ev.r) refCount[ev.r] = (refCount[ev.r] || 0) + 1;
    visitorsAll[ev.v] = 1;
  });
  var daily = Object.keys(byDay).sort().map(function (d) { return { day: d, views: byDay[d].views, visitors: Object.keys(byDay[d].vis).length }; });
  var top = function (obj, keyName) { return Object.keys(obj).map(function (k) { var o = { n: obj[k] }; o[keyName] = k; return o; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10); };

  return send(res, 200, {
    ok: true, provider: storage.provider(), rangeDays: days, truncated: truncated,
    totals: { pageviews: events.length, visitors: Object.keys(visitorsAll).length },
    daily: daily, topPages: top(pageCount, 'p'), topRefs: top(refCount, 'r'),
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'POST') return collect(req, res);
  if (req.method === 'GET') {
    var auth = await requireAuth(req);
    if (!auth) return send(res, 401, { error: 'non autorisé' });
    if (!can('stats.view', auth)) return send(res, 403, { error: 'accès refusé', need: 'stats.view' });
    return stats(req, res);
  }
  return send(res, 405, { error: 'méthode non autorisée' });
};
module.exports.eventFromPathname = eventFromPathname;
module.exports.visitorHash = visitorHash;
module.exports.BOT_RE = BOT_RE;
module.exports.sanitizePath = sanitizePath;
module.exports.sanitizeRef = sanitizeRef;

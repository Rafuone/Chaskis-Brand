// api/collect.js — collecteur d'audience MAISON, sans cookie, host-agnostique (chantier analytics).
// Remplace la lecture des stats Umami (API Pro payante) : on collecte nous-memes et on affiche
// dans l'admin. Stockage via la couture storage.js (Vercel Blob aujourd'hui -> Azure demain).
//
//   POST /api/collect            (PUBLIC) : enregistre une page vue. Corps { p, r, l }.
//   GET  /api/collect?days=30    (capacite stats.view) : agrege et renvoie les stats.
//
// MODELE DE STOCKAGE — append-only SANS perte : 1 evenement = 1 objet Blob dont la CLE encode
// l'evenement en base64url : `analytics/ev/<jour>/<base64url(JSON)>.<alea hex>`. L'agregation se
// fait par LISTING par JOUR (aucune lecture de corps) => pas de course/perte, pas de timeout.
// Visiteur = hash(IP + User-Agent + sel du JOUR) tronque : pseudonyme, rotation quotidienne (aucun
// suivi inter-jours), meme methode qu'Umami. Renforcer avec ANALYTICS_SALT en prod. Anti-bots (UA).
//
// ANTI-ABUS : le POST est PUBLIC. Rate-limit best-effort en memoire (par instance) ci-dessous ;
// une protection DURE (flood distribue, DoS financier) releve de la COUCHE HOTE — regle Vercel
// Firewall / Azure Front Door sur /api/collect (une fonction serverless ne peut pas limiter de
// facon fiable sans magasin partage). Champs bornes (p/r courts) pour contenir cout et pollution.
// SCALE/RETENTION : a fort trafic, stockage agrege (compteurs) ou Azure Table/App Insights (meme
// couture) ; prevoir une purge des vieux jours (`analytics/ev/<jour>`), pas encore automatisee.
'use strict';

var crypto = require('crypto');
var { send, readJson } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');
var storage = require('./_lib/storage');

var PREFIX = 'analytics/ev/';
var MAX_LIST_CALLS = 45;   // borne dure des appels list par agregation (cout advanced-ops + timeout)
var MAX_KEY = 288;         // cle finale < 300 (borne de cleanKey) : garantit AUCUNE troncature/perte
var RL_MAX = 120;          // evenements/min/IP acceptes (best-effort, par instance)
var BOT_RE = /(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|slackbot|vkshare|whatsapp|telegram|discord|headless|phantom|lighthouse|pagespeed|gtmetrix|pingdom|uptime|curl|wget|python-requests|node-fetch|axios|monitor|preview)/i;

function dayKey(d) { return d.toISOString().slice(0, 10); } // YYYY-MM-DD (UTC)

// IP client : on privilegie les en-tetes POSES PAR LA PLATEFORME (non falsifiables par le client)
// plutot que le 1er saut de x-forwarded-for (fourni par le client -> spoofable = gonflage des uniques).
function clientIp(req) {
  var h = (req && req.headers) || {};
  if (h['x-real-ip']) return String(h['x-real-ip']).trim();
  if (h['x-vercel-forwarded-for']) return String(h['x-vercel-forwarded-for']).split(',')[0].trim();
  var xf = (h['x-forwarded-for'] || '').split(',');
  return (xf[xf.length - 1] || '').trim(); // dernier saut (ajoute par le proxy de confiance)
}

// Empreinte visiteur du jour : pseudonyme (SHA-256 tronque), rotative (sel = jour + secret serveur).
// NB : le sel par defaut est une constante publique -> definir ANALYTICS_SALT (ou PING_TOKEN) en
// prod pour empecher un brute-force IP+UA si un listing du store venait a fuiter.
function visitorHash(ip, ua, day) {
  var salt = (process.env.ANALYTICS_SALT || process.env.PING_TOKEN || 'chaskis-analytics') + '|' + day;
  return crypto.createHash('sha256').update(salt + '|' + (ip || '') + '|' + (ua || '')).digest('hex').slice(0, 12);
}

function b64urlDecode(s) { try { return Buffer.from(s, 'base64url').toString('utf8'); } catch (e) { return ''; } }

function sanitizePath(p) {
  p = String(p || '/').split('?')[0].split('#')[0];
  if (p.length > 90) p = p.slice(0, 90);
  return p || '/';
}
function sanitizeRef(r) {
  // On ne garde que l'hôte (referrer = domaine source) : couper à un éventuel chemin, puis chars sûrs.
  return String(r || '').toLowerCase().split('/')[0].replace(/[^a-z0-9.\-]/g, '').slice(0, 48);
}

// Construit la cle d'evenement en GARANTISSANT qu'elle ne depassera pas MAX_KEY : sinon on
// raccourcit le chemin (puis on lache le referrer) et on re-encode. Empeche la troncation par
// cleanKey (qui, sinon, ampute le base64 -> evenement illisible = PERDU silencieusement).
function eventKey(ev, day) {
  var base = PREFIX + day + '/';
  var suffix = '.' + crypto.randomBytes(6).toString('hex');
  var e = { t: ev.t, p: ev.p, r: ev.r, l: ev.l, v: ev.v };
  for (var guard = 0; guard < 12; guard++) {
    var b64 = Buffer.from(JSON.stringify(e), 'utf8').toString('base64url');
    if (base.length + b64.length + suffix.length <= MAX_KEY) return base + b64 + suffix;
    if (e.p && e.p.length > 16) e.p = e.p.slice(0, Math.max(16, e.p.length - 24));
    else if (e.r) e.r = '';
    else break;
  }
  return base + Buffer.from(JSON.stringify(e), 'utf8').toString('base64url') + suffix;
}

// Rate-limit best-effort en memoire (fenetre d'une minute, par instance). Fail-open : sans IP
// fiable on ne bloque pas. Ce n'est PAS une protection anti-DoS dure (voir en-tete de fichier).
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

async function collect(req, res) {
  var ua = (((req && req.headers) || {})['user-agent'] || '');
  if (BOT_RE.test(ua)) return send(res, 200, { ok: true, counted: false, reason: 'bot' });
  var ip = clientIp(req);
  if (rateLimited(ip)) return send(res, 200, { ok: true, counted: false, reason: 'rate' });

  var body = await readJson(req, 8 * 1024, 'charge trop volumineuse');
  if (body && body.__error) return send(res, 400, { error: body.__error });

  var now = new Date();
  var day = dayKey(now);
  var ev = {
    t: now.getTime(),
    p: sanitizePath(body && body.p),
    r: sanitizeRef(body && body.r),
    l: String((body && body.l) || '').slice(0, 2),
    v: visitorHash(ip, ua, day),
  };
  var r = await storage.put(eventKey(ev, day), '1', { contentType: 'text/plain', addRandomSuffix: false });
  if (!r.ok) return send(res, 200, { ok: false, counted: false, error: r.error || 'stockage indisponible' });
  return send(res, 200, { ok: true, counted: true });
}

// Décode un événement depuis une clé Blob : `analytics/ev/<jour>/<b64url>.<hex>`.
// Exige un `t` numérique fini (sinon l'agrégation `new Date(ev.t)` planterait) — fail-soft -> null.
function eventFromPathname(pathname) {
  try {
    var seg = String(pathname).split('/').pop();      // <b64url>.<hex>
    var ev = JSON.parse(b64urlDecode(seg.split('.')[0]));
    if (ev && typeof ev === 'object' && ev.p && typeof ev.t === 'number' && isFinite(ev.t)) return ev;
  } catch (e) {}
  return null;
}

async function stats(req, res) {
  var m = /[?&]days=(\d{1,3})/.exec((req && req.url) || '');
  var days = m ? Math.min(90, Math.max(1, parseInt(m[1], 10))) : 30;
  var since = Date.now() - days * 86400000;

  // Listing PAR JOUR, du plus RECENT au plus ancien (borne l'effort a la fenetre demandee ; evite
  // qu'un historique enorme, liste dans l'ordre lexicographique = plus ancien d'abord, evince les
  // donnees recentes). Aucune lecture de corps.
  var events = [], truncated = false, calls = 0, anyOk = false;
  for (var i = 0; i < days; i++) {
    if (calls >= MAX_LIST_CALLS) { truncated = true; break; }
    var d = dayKey(new Date(Date.now() - i * 86400000));
    var cursor = null, guard = 0;
    do {
      var r = await storage.list(PREFIX + d + '/', 1000, cursor); calls++;
      if (!r || !r.ok) break;
      anyOk = true;
      (r.blobs || []).forEach(function (b) { var ev = eventFromPathname(b.pathname); if (ev && ev.t >= since) events.push(ev); });
      cursor = (r.hasMore && r.cursor) ? r.cursor : null; guard++;
    } while (cursor && calls < MAX_LIST_CALLS && guard < 20);
  }
  if (!anyOk) return send(res, 200, { ok: true, provider: storage.provider(), note: 'stockage indisponible', totals: { pageviews: 0, visitorDays: 0 }, avgDailyVisitors: 0, daily: [], topPages: [], topRefs: [], truncated: false });

  // Agregation.
  var byDay = {}, pageCount = {}, refCount = {}, visitorDays = {};
  events.forEach(function (ev) {
    var d = dayKey(new Date(ev.t));
    if (!byDay[d]) byDay[d] = { views: 0, vis: {} };
    byDay[d].views++; byDay[d].vis[ev.v] = 1;
    pageCount[ev.p] = (pageCount[ev.p] || 0) + 1;
    if (ev.r) refCount[ev.r] = (refCount[ev.r] || 0) + 1;
    visitorDays[d + '|' + ev.v] = 1; // paire (jour, visiteur) : "visiteur-jours" (pas de dedup inter-jours possible)
  });
  var dayKeys = Object.keys(byDay).sort();
  var daily = dayKeys.map(function (d) { return { day: d, views: byDay[d].views, visitors: Object.keys(byDay[d].vis).length }; });
  var visitorDaysTotal = Object.keys(visitorDays).length;
  var avgDailyVisitors = dayKeys.length ? Math.round(visitorDaysTotal / dayKeys.length) : 0;
  var top = function (obj, keyName) { return Object.keys(obj).map(function (k) { var o = { n: obj[k] }; o[keyName] = k; return o; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10); };

  return send(res, 200, {
    ok: true, provider: storage.provider(), rangeDays: days, truncated: truncated,
    // pageviews = pages vues ; visitorDays = somme des visiteurs uniques PAR JOUR (le sel quotidien
    // interdit la deduplication inter-jours) ; avgDailyVisitors = moyenne/jour (chiffre honnete a afficher).
    totals: { pageviews: events.length, visitorDays: visitorDaysTotal },
    avgDailyVisitors: avgDailyVisitors,
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
module.exports.eventKey = eventKey;
module.exports.visitorHash = visitorHash;
module.exports.BOT_RE = BOT_RE;
module.exports.sanitizePath = sanitizePath;
module.exports.sanitizeRef = sanitizeRef;
module.exports.clientIp = clientIp;
module.exports.MAX_KEY = MAX_KEY;

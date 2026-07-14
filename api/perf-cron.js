// api/perf-cron.js — MESURE PLANIFIÉE de la performance (Core Web Vitals + notes Lighthouse).
//
// Appelé par une tâche planifiée (Vercel Cron via `crons` dans vercel.json, ou un timer Azure
// Functions / Logic App sur l'hôte final). Mesure une ou plusieurs pages via PageSpeed (couture
// api/perf.js) et APPEND le résultat à l'historique serveur (api/_lib/perf-store.js). Aussi
// déclenchable manuellement (clé admin) pour tester sans attendre l'heure planifiée.
//
// Auth : Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>` si CRON_SECRET est défini ;
// on accepte aussi la clé admin PUBLISH_SECRET (déclenchement manuel). Refus sinon.
//
// NOTE HÔTE : PageSpeed est lent (10-30 s) ; un plan à faible timeout (Vercel Hobby ~10 s) ne
// mesure de façon fiable qu'UNE page par passage. Défaut = page d'accueil. Sur un hôte au timeout
// large (Azure), on peut auditer plusieurs pages via PERF_CRON_PAGES. Host-agnostique.
'use strict';

var { send } = require('./_lib/http');
var { measure } = require('./perf');
var { safeEqual } = require('./_lib/auth');
var store = require('./_lib/perf-store');

// Pages auditées (chemins relatifs à l'origine). Par défaut la seule page d'accueil (tolère les
// timeouts serrés) ; élargir via PERF_CRON_PAGES="/,/mobilite.html,/postuler.html" sur un hôte lent-permissif.
function pages() {
  var raw = (process.env.PERF_CRON_PAGES || '/').trim();
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

// Origine du site à auditer : PERF_SITE_URL (recommandé) sinon dérivée des en-têtes de la requête.
function baseUrl(req) {
  var env = (process.env.PERF_SITE_URL || '').trim();
  if (env) return env.replace(/\/+$/, '');
  var h = (req && req.headers) || {};
  var host = h['x-forwarded-host'] || h.host || '';
  var proto = h['x-forwarded-proto'] || 'https';
  return host ? (proto + '://' + host) : '';
}

async function authorized(req) {
  var bearer = (((req && req.headers) || {})['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return false;
  var cron = (process.env.CRON_SECRET || '').trim();
  if (cron && safeEqual(bearer, cron)) return true;        // déclenchement par la tâche planifiée
  var pub = (process.env.PUBLISH_SECRET || '').trim();
  if (pub && safeEqual(bearer, pub)) return true;          // déclenchement manuel (clé admin)
  return false;
}

// Aplati une mesure en une entrée d'historique compacte (le fichier reste petit).
function toEntry(ts, page, m) {
  var r = m.result || {}, c = r.categories || {}, met = r.metrics || {};
  function ms(x) { return x && typeof x.ms === 'number' ? Math.round(x.ms) : null; }
  return {
    ts: ts, page: page, strategy: r.strategy || 'mobile', score: r.score,
    a11y: c.accessibility == null ? null : c.accessibility,
    seo: c.seo == null ? null : c.seo,
    bp: c.bestPractices == null ? null : c.bestPractices,
    lcp: ms(met.lcp), cls: (met.cls && typeof met.cls.value === 'number') ? met.cls.value : null, tbt: ms(met.tbt),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: 'méthode non autorisée' });
  if (!(await authorized(req))) return send(res, 401, { error: 'non autorisé' });

  var base = baseUrl(req);
  if (!base) return send(res, 400, { error: 'origine du site introuvable (définir PERF_SITE_URL)' });

  var strategy = 'mobile';
  try { var u = new URL(req.url, 'http://localhost'); if (u.searchParams.get('strategy') === 'desktop') strategy = 'desktop'; } catch (e) {}

  var ts = new Date().toISOString();
  var list = pages(), entries = [], errors = [];
  for (var i = 0; i < list.length; i++) {
    var m = await measure(base + list[i], strategy);
    if (m.ok) entries.push(toEntry(ts, list[i], m));
    else { errors.push({ page: list[i], status: m.status, error: m.error }); if (m.status === 501) break; } // pas de clé -> stop
  }

  var stored = entries.length ? await store.appendMeasurements(entries) : { ok: true, appended: 0 };
  return send(res, 200, { ok: true, ts: ts, measured: entries.length, errors: errors, stored: stored, provider: store.provider() });
};

module.exports.toEntry = toEntry;

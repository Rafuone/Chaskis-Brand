// api/perf-history.js — endpoint SERVEUR de l'historique de performance.
//
// CONSOLIDATION (plan Vercel Hobby limité à 12 Functions) : ce fichier regroupe les deux usages qui
// tournent autour du même historique durable (api/_lib/perf-store.js) — l'ex-api/perf-cron.js a été
// replié ici pour libérer un créneau de fonction.
//
//   GET  /api/perf-history          (capacité perf.view) : LIT l'historique (le plus ancien en tête).
//   GET  /api/perf-history?run=1     (auth CRON_SECRET ou PUBLISH_SECRET) : MESURE PLANIFIÉE — audite
//   POST /api/perf-history?run=1       une ou plusieurs pages via PageSpeed (couture api/perf.js) et
//                                      APPEND le résultat à l'historique. Déclenchée par la tâche
//                                      planifiée (Vercel Cron `crons` -> ce path ; timer Azure sur
//                                      l'hôte final) ou manuellement (clé admin) pour tester.
//
// Repli fail-soft en lecture : stockage indisponible -> liste vide (l'admin retombe sur son local).
// Auth de la mesure : Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>` si défini ; on accepte
// aussi PUBLISH_SECRET (déclenchement manuel). SÉCURITÉ origine : voir resolveBase (anti-abus quota).
// NOTE HÔTE : PageSpeed est lent (10-30 s) ; un timeout serré (Vercel Hobby ~10 s) ne mesure de façon
// fiable qu'UNE page/passage (défaut = accueil) ; élargir via PERF_CRON_PAGES sur un hôte permissif.
'use strict';

var { send } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');
var { measure } = require('./perf');
var { safeEqual } = require('./_lib/auth');
var store = require('./_lib/perf-store');

// ---------------------------------------------------------------------------
// Mesure planifiée (ex api/perf-cron.js)
// ---------------------------------------------------------------------------

// Pages auditées (chemins relatifs à l'origine). Défaut = accueil seule (tolère les timeouts serrés) ;
// élargir via PERF_CRON_PAGES="/,/mobilite.html,/postuler.html" sur un hôte lent-permissif.
function pages() {
  var raw = (process.env.PERF_CRON_PAGES || '/').trim();
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

// Origine du site à auditer. SÉCURITÉ (revue) : un en-tête (x-forwarded-host) est contrôlable par
// l'appelant ; le truster laisserait un détenteur de CRON_SECRET faire auditer un hôte ARBITRAIRE
// (abus de quota PageSpeed + commits dans le dépôt). On n'accepte donc une origine que si elle est
// EXPLICITEMENT configurée : PERF_SITE_URL (recommandé, chemin prod) OU un hôte dérivé présent dans
// l'allow-list PERF_ALLOWED_HOSTS. Sinon `trusted:false` -> refus (403). { base, trusted }.
function resolveBase(req) {
  var env = (process.env.PERF_SITE_URL || '').trim();
  if (env) return { base: env.replace(/\/+$/, ''), trusted: true };
  var h = (req && req.headers) || {};
  var host = h['x-forwarded-host'] || h.host || '';
  var proto = h['x-forwarded-proto'] || 'https';
  if (!host) return { base: '', trusted: false };
  var allow = (process.env.PERF_ALLOWED_HOSTS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return { base: proto + '://' + host, trusted: allow.indexOf(host) >= 0 };
}

async function measureAuthorized(req) {
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

async function runMeasurement(req, res) {
  if (!(await measureAuthorized(req))) return send(res, 401, { error: 'non autorisé' });

  var rb = resolveBase(req);
  if (!rb.base) return send(res, 400, { error: 'origine du site introuvable (définir PERF_SITE_URL)' });
  if (!rb.trusted) return send(res, 403, { error: 'origine non fiable : définir PERF_SITE_URL (ou ajouter l\'hôte à PERF_ALLOWED_HOSTS)' });
  var base = rb.base;

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
}

// ---------------------------------------------------------------------------
// Lecture de l'historique (ex api/perf-history.js)
// ---------------------------------------------------------------------------

async function readHistory(req, res) {
  var auth = await requireAuth(req);
  if (!auth) return send(res, 401, { error: 'non autorisé' });
  if (!can('perf.view', auth)) return send(res, 403, { error: 'accès refusé', need: 'perf.view' });

  var entries = await store.readHistory();
  return send(res, 200, { ok: true, entries: entries, provider: store.provider() });
}

module.exports = async function handler(req, res) {
  // Discriminant EXPLICITE `?run=1` (jamais basé sur le secret, pour ne pas confondre un lecteur admin
  // avec un déclencheur) : la tâche planifiée / le déclenchement manuel demandent une MESURE ; tout le
  // reste est une LECTURE de l'historique.
  var run = false;
  try { run = new URL(req.url, 'http://localhost').searchParams.get('run') === '1'; } catch (e) {}
  if (run) return runMeasurement(req, res);
  if (req.method === 'GET') return readHistory(req, res);
  return send(res, 405, { error: 'méthode non autorisée' });
};

module.exports.toEntry = toEntry;

// api/perf.js — Vercel Serverless Function, route GET /api/perf?url=<page>&strategy=mobile.
//
// Core Web Vitals RÉELS via Google PageSpeed Insights — la seule mesure que l'audit
// navigateur de l'admin ne peut pas faire (LCP, CLS, TBT, score de performance). L'admin
// garde son audit local (référencement/lisibilité/poids) ; cet endpoint ajoute la vitesse
// mesurée par Google quand une clé est configurée.
//
// COUTURE activable par clé : sans PAGESPEED_KEY -> 501, l'admin conserve son estimation.
// Auth Bearer PUBLISH_SECRET (comme les autres endpoints) : la clé PageSpeed et le quota
// ne sont pas exposés au public. Host-agnostique (Azure : même API Google, timeout de
// fonction plus large — voir docs/perf.md).
//
// Convention projet : CommonJS, réponse Node brute, aucune dépendance (fetch + crypto
// natifs Node 18+).
//
// Variables d'environnement :
//   PUBLISH_SECRET : clé partagée (déjà utilisée par publish/history/restore/calendly).
//   PAGESPEED_KEY  : clé API Google PageSpeed Insights (gratuite).
'use strict';

var { send } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');

var PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Extrait les métriques utiles du résultat Lighthouse renvoyé par PageSpeed.
function extract(j) {
  var lr = (j && j.lighthouseResult) || {};
  var au = lr.audits || {};
  var cats = lr.categories || {};
  function catScore(k) { var c = cats[k]; return (c && typeof c.score === 'number') ? Math.round(c.score * 100) : null; } // 0..100
  function num(id) { var a = au[id]; return (a && typeof a.numericValue === 'number') ? a.numericValue : null; }
  function disp(id) { var a = au[id]; return (a && a.displayValue) || null; }
  return {
    score: catScore('performance'), // rétrocompat : score = performance
    // Google (Lighthouse) note quatre domaines dans le même passage. La vitesse (performance)
    // alimente les tuiles CWV ; accessibilité / SEO / bonnes pratiques donnent l'avis de Google
    // en complément de l'audit local de l'admin.
    categories: {
      performance: catScore('performance'),
      accessibility: catScore('accessibility'),
      seo: catScore('seo'),
      bestPractices: catScore('best-practices'),
    },
    metrics: {
      lcp: { ms: num('largest-contentful-paint'), display: disp('largest-contentful-paint') },
      cls: { value: num('cumulative-layout-shift'), display: disp('cumulative-layout-shift') },
      tbt: { ms: num('total-blocking-time'), display: disp('total-blocking-time') },
      fcp: { ms: num('first-contentful-paint'), display: disp('first-contentful-paint') },
      si: { ms: num('speed-index'), display: disp('speed-index') },
    },
  };
}

// Mesure PURE d'une URL via PageSpeed. Réutilisée par l'endpoint (à la demande) ET par le cron
// (mesure planifiée). Ne jette pas ; renvoie { ok, status, error?, result? }. Le `result` a la
// même forme que la réponse de l'endpoint (url, strategy, score, categories, metrics).
async function measure(url, strategy, opts) {
  opts = opts || {};
  var key = (opts.key || process.env.PAGESPEED_KEY || '').trim();
  if (!key) return { ok: false, status: 501, error: 'PageSpeed non configuré (PAGESPEED_KEY absent)' };
  // On n'audite que des URLs http(s) publiques (PageSpeed ne voit que le web public).
  if (!/^https?:\/\//i.test(url || '') || String(url).length > 2048) return { ok: false, status: 400, error: 'paramètre url invalide (http(s) requis)' };
  strategy = strategy === 'desktop' ? 'desktop' : 'mobile';
  // PageSpeed est LENT (souvent 10-30 s). Le plan Vercel Hobby coupe vers ~10 s : fiable surtout
  // sur un hôte au timeout plus large (Azure App Service, Vercel Pro). Délai réglable par env.
  var TIMEOUT_MS = opts.timeoutMs || parseInt(process.env.PERF_TIMEOUT_MS, 10) || 9000;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    var cats = ['performance', 'accessibility', 'seo', 'best-practices'];
    var api = PSI + '?url=' + encodeURIComponent(url) + '&strategy=' + strategy + cats.map(function (c) { return '&category=' + c; }).join('') + '&key=' + encodeURIComponent(key);
    var r = await fetch(api, { signal: ctrl.signal });
    if (r.status === 429) return { ok: false, status: 429, error: 'quota PageSpeed dépassé' };
    if (!r.ok) return { ok: false, status: 502, error: 'PageSpeed a échoué (' + r.status + ')' };
    var j = await r.json();
    var out = extract(j);
    return { ok: true, status: 200, result: { url: url, strategy: strategy, score: out.score, categories: out.categories, metrics: out.metrics } };
  } catch (e) {
    var aborted = e && e.name === 'AbortError';
    return { ok: false, status: aborted ? 504 : 502, error: aborted ? 'délai PageSpeed dépassé (mesure trop longue pour le timeout de la fonction)' : 'erreur réseau PageSpeed' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });

  var auth = await requireAuth(req);
  if (!auth) return send(res, 401, { error: 'non autorisé' });
  // Capacité requise : voir la performance (perf.view).
  if (!can('perf.view', auth)) return send(res, 403, { error: 'accès refusé', need: 'perf.view' });

  var url = '', strategy = 'mobile';
  try {
    var u = new URL(req.url, 'http://localhost');
    url = (u.searchParams.get('url') || '').trim();
    if (u.searchParams.get('strategy') === 'desktop') strategy = 'desktop';
  } catch (e) {}

  var m = await measure(url, strategy);
  if (!m.ok) return send(res, m.status, { error: m.error });
  return send(res, 200, Object.assign({ ok: true }, m.result));
};

// Exposé pour les tests + réutilisé par le cron de mesure planifiée.
module.exports.extract = extract;
module.exports.measure = measure;

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
var { requireBearer } = require('./_lib/auth');

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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });

  if (!requireBearer(req)) return send(res, 401, { error: 'non autorisé' });

  var key = (process.env.PAGESPEED_KEY || '').trim();
  if (!key) return send(res, 501, { error: 'PageSpeed non configuré (PAGESPEED_KEY absent)' });

  var url = '', strategy = 'mobile';
  try {
    var u = new URL(req.url, 'http://localhost');
    url = (u.searchParams.get('url') || '').trim();
    if (u.searchParams.get('strategy') === 'desktop') strategy = 'desktop';
  } catch (e) {}
  // On n'audite que des URLs http(s) publiques (PageSpeed ne voit que le web public).
  if (!/^https?:\/\//i.test(url) || url.length > 2048) return send(res, 400, { error: 'paramètre url invalide (http(s) requis)' });

  // PageSpeed est LENT (souvent 10-30 s). Le plan Vercel Hobby coupe vers ~10 s : ce endpoint
  // est donc fiable surtout sur un hôte au timeout plus large (Azure App Service, Vercel Pro).
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 9000);
  try {
    var cats = ['performance', 'accessibility', 'seo', 'best-practices'];
    var api = PSI + '?url=' + encodeURIComponent(url) + '&strategy=' + strategy + cats.map(function (c) { return '&category=' + c; }).join('') + '&key=' + encodeURIComponent(key);
    var r = await fetch(api, { signal: ctrl.signal });
    if (r.status === 429) return send(res, 429, { error: 'quota PageSpeed dépassé' });
    if (!r.ok) return send(res, 502, { error: 'PageSpeed a échoué (' + r.status + ')' });
    var j = await r.json();
    var out = extract(j);
    return send(res, 200, { ok: true, url: url, strategy: strategy, score: out.score, categories: out.categories, metrics: out.metrics });
  } catch (e) {
    var aborted = e && e.name === 'AbortError';
    return send(res, aborted ? 504 : 502, { error: aborted ? 'délai PageSpeed dépassé (mesure trop longue pour le timeout de la fonction)' : 'erreur réseau PageSpeed' });
  } finally {
    clearTimeout(timer);
  }
};

// Exposé pour les tests.
module.exports.extract = extract;

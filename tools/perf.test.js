// tools/perf.test.js — harnais de test de l'endpoint Core Web Vitals (api/perf), SANS dépendance.
// Couvre extract() (pur) + l'endpoint (auth, non configuré, url invalide, succès mocké).
// Lancer : node tools/perf.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, end: function (s) { this.body = s; }, json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } } }; }
function fakeReq(method, url, headers) { return { method: method, url: url, headers: headers || {} }; }
function load() { delete require.cache[require.resolve(path.join(ROOT, 'api/perf.js'))]; return require(path.join(ROOT, 'api/perf.js')); }
async function call(url, headers) { var h = load(); var res = fakeRes(); await h(fakeReq('GET', url, headers), res); return res; }

(async function () {
  section('extract() — parsing Lighthouse');
  var perf = load();
  var sample = { lighthouseResult: { categories: { performance: { score: 0.92 }, accessibility: { score: 0.88 }, seo: { score: 1 }, 'best-practices': { score: 0.75 } }, audits: {
    'largest-contentful-paint': { numericValue: 2100, displayValue: '2.1 s' },
    'cumulative-layout-shift': { numericValue: 0.03, displayValue: '0.03' },
    'total-blocking-time': { numericValue: 150, displayValue: '150 ms' },
    'first-contentful-paint': { numericValue: 1200, displayValue: '1.2 s' },
    'speed-index': { numericValue: 3000, displayValue: '3.0 s' },
  } } };
  var e = perf.extract(sample);
  ok(e.score === 92, 'score performance 0.92 -> 92');
  ok(e.categories.performance === 92 && e.categories.accessibility === 88 && e.categories.seo === 100 && e.categories.bestPractices === 75, 'catégories Lighthouse extraites (perf/a11y/seo/bonnes pratiques)');
  ok(e.metrics.lcp.ms === 2100 && e.metrics.lcp.display === '2.1 s', 'LCP extrait');
  ok(e.metrics.cls.value === 0.03 && e.metrics.tbt.ms === 150, 'CLS + TBT extraits');
  ok(perf.extract({}).score === null && perf.extract({}).categories.seo === null, 'résultat vide -> scores null (pas de crash)');

  section('Endpoint GET /api/perf');
  var saved = process.env.PUBLISH_SECRET, savedK = process.env.PAGESPEED_KEY;
  process.env.PUBLISH_SECRET = 'sek';

  var rPost = fakeRes(); var h = load(); await h({ method: 'POST', url: '/api/perf', headers: {} }, rPost);
  ok(rPost.statusCode === 405, 'POST -> 405');

  delete process.env.PAGESPEED_KEY;
  ok((await call('/api/perf?url=https://x.ch', {})).statusCode === 401, 'sans clé Bearer -> 401');
  ok((await call('/api/perf?url=https://x.ch', { authorization: 'Bearer sek' })).statusCode === 501, 'clé OK mais PAGESPEED_KEY absent -> 501');

  process.env.PAGESPEED_KEY = 'psk';
  ok((await call('/api/perf?url=pas-une-url', { authorization: 'Bearer sek' })).statusCode === 400, 'url invalide -> 400');

  var realFetch = global.fetch;
  global.fetch = async function () { return { ok: true, status: 200, json: async function () { return sample; } }; };
  var r200 = await call('/api/perf?url=https://chaskis.ch&strategy=mobile', { authorization: 'Bearer sek' });
  global.fetch = realFetch;
  var j = r200.json();
  ok(r200.statusCode === 200 && j.ok && j.score === 92 && j.metrics.lcp.ms === 2100, '200 : CWV réels renvoyés (fetch mocké)');
  ok(j.categories && j.categories.accessibility === 88 && j.categories.seo === 100, '200 : catégories accessibilité/SEO renvoyées');
  ok(j.strategy === 'mobile' && j.url === 'https://chaskis.ch', 'écho url + strategy');

  section('measure() — fonction réutilisée par le cron');
  var P = load();
  delete process.env.PAGESPEED_KEY;
  ok((await P.measure('https://x.ch', 'mobile')).status === 501, 'measure sans clé -> 501');
  process.env.PAGESPEED_KEY = 'psk';
  ok((await P.measure('pas-une-url', 'mobile')).status === 400, 'measure url invalide -> 400');
  global.fetch = async function () { return { ok: true, status: 200, json: async function () { return sample; } }; };
  var mm = await P.measure('https://chaskis.ch', 'desktop');
  global.fetch = realFetch;
  ok(mm.ok && mm.result.score === 92 && mm.result.strategy === 'desktop' && mm.result.categories.seo === 100, 'measure OK -> result normalisé (score/strategy/catégories)');
  global.fetch = async function () { return { ok: false, status: 429 }; };
  ok((await P.measure('https://x.ch', 'mobile')).status === 429, 'measure quota -> 429');
  global.fetch = realFetch;

  process.env.PUBLISH_SECRET = saved; if (saved === undefined) delete process.env.PUBLISH_SECRET;
  if (savedK !== undefined) process.env.PAGESPEED_KEY = savedK; else delete process.env.PAGESPEED_KEY;

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

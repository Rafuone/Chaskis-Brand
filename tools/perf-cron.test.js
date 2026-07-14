// tools/perf-cron.test.js — mesure PLANIFIÉE + historique SERVEUR de la performance.
// Couvre : api/_lib/perf-store.js (mémoire + GitHub mocké), api/perf-cron.js (auth, boucle de
// mesure PageSpeed mockée, stockage, erreurs), api/perf-history.js (auth + capacité). Sans réseau.
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, end: function (s) { this.body = s; }, json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } } }; }
function loadStore() { delete require.cache[require.resolve(path.join(ROOT, 'api/_lib/perf-store.js'))]; return require(path.join(ROOT, 'api/_lib/perf-store.js')); }
function loadCron() { delete require.cache[require.resolve(path.join(ROOT, 'api/perf-cron.js'))]; return require(path.join(ROOT, 'api/perf-cron.js')); }
function loadHistory() { delete require.cache[require.resolve(path.join(ROOT, 'api/perf-history.js'))]; return require(path.join(ROOT, 'api/perf-history.js')); }

var SAMPLE = { lighthouseResult: { categories: { performance: { score: 0.7 }, accessibility: { score: 0.9 }, seo: { score: 1 }, 'best-practices': { score: 0.8 } }, audits: {
  'largest-contentful-paint': { numericValue: 2500, displayValue: '2.5 s' },
  'cumulative-layout-shift': { numericValue: 0.02, displayValue: '0.02' },
  'total-blocking-time': { numericValue: 300, displayValue: '300 ms' },
} } };

(async function () {
  var saved = { PERF_STORE: process.env.PERF_STORE, GT: process.env.GITHUB_TOKEN, GR: process.env.GITHUB_REPO, GB: process.env.GITHUB_BRANCH, PS: process.env.PAGESPEED_KEY, SEC: process.env.PUBLISH_SECRET, CRON: process.env.CRON_SECRET, SITE: process.env.PERF_SITE_URL, PAGES: process.env.PERF_CRON_PAGES };
  var realFetch = global.fetch;

  // ============================ perf-store (mémoire) ============================
  section('perf-store — fournisseur mémoire');
  process.env.PERF_STORE = 'memory';
  delete process.env.GITHUB_TOKEN; delete process.env.GITHUB_REPO;
  var store = loadStore(); store._resetMemory();
  ok(store.provider() === 'memory', 'PERF_STORE=memory -> provider memory');
  ok((await store.readHistory()).length === 0, 'historique vide au départ');
  await store.appendMeasurements([{ ts: 't1', page: '/', score: 80 }, { ts: 't1', page: '/x', score: 70 }]);
  ok((await store.readHistory()).length === 2, 'append de 2 -> 2 entrées');
  var many = []; for (var i = 0; i < store.MAX_ENTRIES + 20; i++) many.push({ ts: 't', page: '/', score: i });
  await store.appendMeasurements(many);
  var capped = await store.readHistory();
  ok(capped.length === store.MAX_ENTRIES, 'fenêtre glissante : rognée à MAX_ENTRIES (' + capped.length + ')');
  ok(capped[capped.length - 1].score === store.MAX_ENTRIES + 19, 'les plus récentes sont conservées');

  // ============================ perf-store (GitHub mocké) ============================
  section('perf-store — fournisseur GitHub (mocké, durable)');
  process.env.PERF_STORE = 'github';
  process.env.GITHUB_TOKEN = 'ghtok'; process.env.GITHUB_REPO = 'owner/repo'; process.env.GITHUB_BRANCH = 'main';
  var gstore = loadStore();
  var fileContent = null, sha = null;
  global.fetch = async function (url, opts) {
    var method = (opts && opts.method) || 'GET';
    if (method === 'GET') {
      if (fileContent == null) return { ok: false, status: 404, json: async function () { return {}; } };
      return { ok: true, status: 200, json: async function () { return { content: Buffer.from(fileContent, 'utf8').toString('base64'), sha: sha }; } };
    }
    var body = JSON.parse(opts.body);
    fileContent = Buffer.from(body.content, 'base64').toString('utf8'); sha = 'sha_' + fileContent.length;
    return { ok: true, status: 200, json: async function () { return { content: body.content, sha: sha }; } };
  };
  ok(gstore.provider() === 'github', 'PERF_STORE=github -> provider github');
  var res1 = await gstore.appendMeasurements([{ ts: 'g1', page: '/', score: 88, a11y: 90, seo: 100 }]);
  ok(res1.ok && res1.appended === 1, 'append GitHub -> ok (lecture 404 -> écriture PUT)');
  var back = await gstore.readHistory();
  ok(back.length === 1 && back[0].score === 88 && back[0].seo === 100, 'relecture GitHub : entrée persistée');
  var res2 = await gstore.appendMeasurements([{ ts: 'g2', page: '/', score: 91 }]);
  ok(res2.ok && (await gstore.readHistory()).length === 2, 'append incrémental (relit le sha, ajoute)');
  global.fetch = async function () { throw new Error('réseau coupé'); };
  ok((await gstore.readHistory()).length === 0, 'lecture en échec -> [] (fail-soft, l\'admin garde son local)');
  global.fetch = realFetch;

  // ============================ perf-cron (endpoint planifié) ============================
  section('perf-cron — mesure planifiée');
  process.env.PERF_STORE = 'memory';
  process.env.PAGESPEED_KEY = 'psk'; process.env.PUBLISH_SECRET = 'sek';
  process.env.PERF_SITE_URL = 'https://site.test'; process.env.PERF_CRON_PAGES = '/';
  delete process.env.CRON_SECRET;
  var cstore = loadStore(); cstore._resetMemory();
  var cron = loadCron();
  function cronReq(bearer, method) { return { method: method || 'GET', url: '/api/perf-cron', headers: bearer ? { authorization: 'Bearer ' + bearer } : {} }; }

  var rNo = fakeRes(); await cron(cronReq(null), rNo);
  ok(rNo.statusCode === 401, 'sans secret -> 401');
  var rBad = fakeRes(); await cron(cronReq('faux'), rBad);
  ok(rBad.statusCode === 401, 'mauvais secret -> 401');

  global.fetch = async function () { return { ok: true, status: 200, json: async function () { return SAMPLE; } }; };
  var rOk = fakeRes(); await cron(cronReq('sek'), rOk);
  var jOk = rOk.json();
  ok(rOk.statusCode === 200 && jOk.measured === 1 && jOk.stored.ok, 'clé admin -> 200, 1 page mesurée + stockée');
  ok((await cstore.readHistory()).length === 1, 'la mesure est bien dans l\'historique serveur');
  var last = (await cstore.readHistory())[0];
  ok(last.score === 70 && last.a11y === 90 && last.seo === 100 && last.lcp === 2500, 'entrée aplatie correcte (score/a11y/seo/lcp)');

  process.env.CRON_SECRET = 'cronsecret';
  var cron2 = loadCron();
  var rCron = fakeRes(); await cron2(cronReq('cronsecret'), rCron);
  ok(rCron.statusCode === 200, 'secret de cron (CRON_SECRET) accepté');
  global.fetch = realFetch;

  // Sans clé PageSpeed : mesure 0, erreur 501 remontée, pas de crash.
  delete process.env.PAGESPEED_KEY;
  cstore._resetMemory();
  var cron3 = loadCron();
  var rNoKey = fakeRes(); await cron3(cronReq('sek'), rNoKey);
  var jNoKey = rNoKey.json();
  ok(rNoKey.statusCode === 200 && jNoKey.measured === 0 && jNoKey.errors.length >= 1 && jNoKey.errors[0].status === 501, 'sans PAGESPEED_KEY -> 200, 0 mesurée, erreur 501 signalée');

  // Sans origine déterminable -> 400.
  delete process.env.PERF_SITE_URL;
  var cron4 = loadCron();
  var rNoBase = fakeRes(); await cron4({ method: 'GET', url: '/api/perf-cron', headers: { authorization: 'Bearer sek' } }, rNoBase);
  ok(rNoBase.statusCode === 400, 'origine introuvable (ni PERF_SITE_URL ni host) -> 400');
  process.env.PERF_SITE_URL = 'https://site.test';

  // ============================ perf-history (lecture) ============================
  section('perf-history — lecture (capacité perf.view)');
  process.env.PERF_STORE = 'memory';
  var hstore = loadStore(); hstore._resetMemory();
  await hstore.appendMeasurements([{ ts: 'h1', page: '/', score: 90 }]);
  var hist = loadHistory();
  function histReq(bearer, method) { return { method: method || 'GET', url: '/api/perf-history', headers: bearer ? { authorization: 'Bearer ' + bearer } : {} }; }
  var rH401 = fakeRes(); await hist(histReq(null), rH401);
  ok(rH401.statusCode === 401, 'sans auth -> 401');
  var rH405 = fakeRes(); await hist(histReq('sek', 'POST'), rH405);
  ok(rH405.statusCode === 405, 'POST -> 405');
  var rH200 = fakeRes(); await hist(histReq('sek'), rH200);
  var jH = rH200.json();
  ok(rH200.statusCode === 200 && jH.ok && Array.isArray(jH.entries) && jH.entries.length === 1, '200 : renvoie l\'historique serveur');

  Object.keys(saved).forEach(function (k) { var envk = { PERF_STORE: 'PERF_STORE', GT: 'GITHUB_TOKEN', GR: 'GITHUB_REPO', GB: 'GITHUB_BRANCH', PS: 'PAGESPEED_KEY', SEC: 'PUBLISH_SECRET', CRON: 'CRON_SECRET', SITE: 'PERF_SITE_URL', PAGES: 'PERF_CRON_PAGES' }[k]; if (saved[k] === undefined) delete process.env[envk]; else process.env[envk] = saved[k]; });
  global.fetch = realFetch;

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

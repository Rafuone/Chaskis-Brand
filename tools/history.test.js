// tools/history.test.js — harnais de l'endpoint GET /api/history (liste des versions publiées).
// L'API GitHub Commits est MOCKÉE (aucun réseau, aucune clé).  node tools/history.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, end: function (s) { this.body = s; }, json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } } }; }
function load() { delete require.cache[require.resolve(path.join(ROOT, 'api/history.js'))]; return require(path.join(ROOT, 'api/history.js')); }
function req(method, headers) { return { method: method, url: '/api/history', headers: headers || {} }; }
function installFetch(responses) {
  var calls = []; var i = 0;
  global.fetch = async function (url, opts) {
    calls.push({ url: String(url), opts: opts || {} });
    var r = responses[i++] || responses[responses.length - 1];
    if (r.throw) { var e = new Error('mock'); e.name = r.throw; throw e; }
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async function () { return r.body || {}; } };
  };
  return calls;
}
async function call(request) { var h = load(); var res = fakeRes(); await h(request, res); return res; }
var AUTH = { authorization: 'Bearer sek' };

(async function () {
  var savedSecret = process.env.PUBLISH_SECRET, savedTok = process.env.GITHUB_TOKEN, savedRepo = process.env.GITHUB_REPO, realFetch = global.fetch;
  process.env.PUBLISH_SECRET = 'sek';

  section('Méthode & authentification');
  ok((await call(req('POST', AUTH))).statusCode === 405, 'POST -> 405 (lecture seule)');
  ok((await call(req('GET', {}))).statusCode === 401, 'sans Bearer -> 401');
  ok((await call(req('GET', { authorization: 'Bearer FAUX' }))).statusCode === 401, 'mauvais secret -> 401');

  section('Configuration & lecture GitHub (mockée)');
  delete process.env.GITHUB_TOKEN; delete process.env.GITHUB_REPO;
  ok((await call(req('GET', AUTH))).statusCode === 500, 'GITHUB_TOKEN/REPO absents -> 500');

  process.env.GITHUB_TOKEN = 'ghtok'; process.env.GITHUB_REPO = 'owner/repo';
  var calls = installFetch([{ status: 200, body: [
    { sha: 'aaaaaaa1111', commit: { author: { name: 'Alex', date: '2026-07-13T10:00:00Z' }, message: 'publish V2 par Alex\n\ndétails ignorés' } },
    { sha: 'bbbbbbb2222', commit: { author: { name: 'Test', date: '2026-07-12T09:00:00Z' }, message: 'publish V1 par Test' } },
  ] }]);
  var r200 = await call(req('GET', AUTH));
  var j = r200.json();
  ok(r200.statusCode === 200 && j.ok && Array.isArray(j.versions) && j.versions.length === 2, '200 : liste de versions renvoyée');
  ok(j.versions[0].shortSha === 'aaaaaaa' && j.versions[0].author === 'Alex', 'shortSha (7) + auteur extraits');
  ok(j.versions[0].message === 'publish V2 par Alex', 'message = première ligne seulement');
  ok(calls[0].url.indexOf('/commits?') >= 0 && calls[0].url.indexOf('path=site-content.json') >= 0, 'appelle bien l\'API commits filtrée sur site-content.json');

  ok((await (async () => { installFetch([{ status: 403 }]); return call(req('GET', AUTH)); })()).statusCode === 502, 'lecture GitHub non-200 -> 502');
  ok((await (async () => { installFetch([{ throw: 'AbortError' }]); return call(req('GET', AUTH)); })()).statusCode === 504, 'timeout (AbortError) -> 504');

  process.env.PUBLISH_SECRET = savedSecret; if (savedSecret === undefined) delete process.env.PUBLISH_SECRET;
  process.env.GITHUB_TOKEN = savedTok; if (savedTok === undefined) delete process.env.GITHUB_TOKEN;
  process.env.GITHUB_REPO = savedRepo; if (savedRepo === undefined) delete process.env.GITHUB_REPO;
  global.fetch = realFetch;

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

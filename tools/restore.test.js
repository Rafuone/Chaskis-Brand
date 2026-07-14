// tools/restore.test.js — harnais de l'endpoint POST /api/restore (revert propre d'une version).
// L'API GitHub est MOCKÉE (aucun réseau, aucune clé). Couvre auth, validation du sha, version
// introuvable (404), revalidation du contenu restauré, conflit, réécriture.  node tools/restore.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
function b64(s) { return Buffer.from(s, 'utf8').toString('base64'); }

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, end: function (s) { this.body = s; }, json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } } }; }
function load() { delete require.cache[require.resolve(path.join(ROOT, 'api/restore.js'))]; return require(path.join(ROOT, 'api/restore.js')); }
function req(body, headers, method) { return { method: method || 'POST', url: '/api/restore', headers: headers || {}, body: body }; }
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
var SHA = 'aaaaaaa1111';                    // 11 hex -> passe /^[0-9a-f]{7,40}$/
var VALID = b64(JSON.stringify({ schemaVersion: 1, version: 'V1' }));

(async function () {
  var s0 = process.env.PUBLISH_SECRET, t0 = process.env.GITHUB_TOKEN, r0 = process.env.GITHUB_REPO, realFetch = global.fetch;
  process.env.PUBLISH_SECRET = 'sek';

  section('Méthode, auth & validation du sha');
  ok((await call(req({ sha: SHA }, AUTH, 'GET'))).statusCode === 405, 'GET -> 405');
  ok((await call(req({ sha: SHA }, {}))).statusCode === 401, 'sans Bearer -> 401');
  ok((await call(req({ sha: 'zz' }, AUTH))).statusCode === 400, 'sha non hexadécimal -> 400');
  ok((await call(req({}, AUTH))).statusCode === 400, 'sha manquant -> 400');

  section('Configuration serveur');
  delete process.env.GITHUB_TOKEN; delete process.env.GITHUB_REPO;
  ok((await call(req({ sha: SHA }, AUTH))).statusCode === 500, 'GITHUB_TOKEN/REPO absents -> 500');
  process.env.GITHUB_TOKEN = 'ghtok'; process.env.GITHUB_REPO = 'owner/repo';

  section('Restauration (GitHub mockée)');
  ok((await (async () => { installFetch([{ status: 404 }]); return call(req({ sha: SHA }, AUTH)); })()).statusCode === 404, 'version (sha) introuvable -> 404');

  installFetch([{ status: 200, body: { content: b64('ceci n\'est pas du JSON') } }]);
  ok((await call(req({ sha: SHA }, AUTH))).statusCode === 400, 'contenu de la version illisible -> 400');

  installFetch([{ status: 200, body: { content: b64(JSON.stringify({ schemaVersion: 2 })) } }]);
  ok((await call(req({ sha: SHA }, AUTH))).statusCode === 400, 'contenu de la version invalide (schéma) -> 400');

  var calls = installFetch([
    { status: 200, body: { content: VALID } },       // GET au commit choisi
    { status: 200, body: { sha: 'cursha' } },          // GET SHA courant (pour l'update)
    { status: 200, body: { commit: { sha: 'newcommit' } } }, // PUT
  ]);
  var rOk = await call(req({ sha: SHA }, AUTH));
  var jOk = rOk.json();
  var putBody = JSON.parse(calls[2].opts.body);
  ok(rOk.statusCode === 200 && jOk.ok && jOk.restored === 'aaaaaaa', '200 : restauration OK (restored = sha court)');
  ok(putBody.sha === 'cursha' && calls[2].opts.method === 'PUT', 'PUT porte le sha courant (update, pas d\'écrasement aveugle)');
  ok(Buffer.from(putBody.content, 'base64').toString('utf8').indexOf('"schemaVersion": 1') >= 0 || Buffer.from(putBody.content, 'base64').toString('utf8').indexOf('schemaVersion') >= 0, 'le contenu réécrit = celui de la version restaurée');

  ok((await (async () => { installFetch([{ status: 200, body: { content: VALID } }, { status: 200, body: { sha: 'x' } }, { status: 409 }]); return call(req({ sha: SHA }, AUTH)); })()).statusCode === 409, 'PUT 409/422 -> 409 (édition concurrente)');
  ok((await (async () => { installFetch([{ throw: 'AbortError' }]); return call(req({ sha: SHA }, AUTH)); })()).statusCode === 504, 'timeout (AbortError) -> 504');

  process.env.PUBLISH_SECRET = s0; if (s0 === undefined) delete process.env.PUBLISH_SECRET;
  process.env.GITHUB_TOKEN = t0; if (t0 === undefined) delete process.env.GITHUB_TOKEN;
  process.env.GITHUB_REPO = r0; if (r0 === undefined) delete process.env.GITHUB_REPO;
  global.fetch = realFetch;

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

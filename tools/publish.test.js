// tools/publish.test.js — harnais de l'endpoint d'ÉCRITURE (api/publish.js), le plus sensible.
// L'API GitHub est MOCKÉE (aucun réseau, aucune clé). Couvre auth, validation, création vs
// mise à jour (SHA), conflit concurrent, erreurs amont, timeout, et la lecture robuste du
// corps (accents multi-octets répartis sur plusieurs chunks).  Lancer : node tools/publish.test.js
'use strict';

var path = require('path');
var { Readable } = require('stream');
var ROOT = path.resolve(__dirname, '..');

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, end: function (s) { this.body = s; }, json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } } }; }
function load() { delete require.cache[require.resolve(path.join(ROOT, 'api/publish.js'))]; return require(path.join(ROOT, 'api/publish.js')); }

// req « Vercel » : corps déjà parsé (req.body).
function req(body, headers) { return { method: 'POST', url: '/api/publish', headers: headers || {}, body: body }; }
// req « Node brut » : flux lisible (teste readJson).
function streamReq(chunks, headers) { var r = Readable.from(chunks); r.method = 'POST'; r.url = '/api/publish'; r.headers = headers || {}; return r; }

// fetch mocké programmable : une file de réponses {status, body?, throw?}. Capture les appels.
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

async function call(request, headers) { var h = load(); var res = fakeRes(); await h(request, res); return res; }
var AUTH = { authorization: 'Bearer sek' };
var VALID = { schemaVersion: 1, version: 'V1', updatedBy: 'Test' };

(async function () {
  var savedSecret = process.env.PUBLISH_SECRET, savedTok = process.env.GITHUB_TOKEN, savedRepo = process.env.GITHUB_REPO, savedBr = process.env.GITHUB_BRANCH, realFetch = global.fetch;
  process.env.PUBLISH_SECRET = 'sek';

  section('Méthode & authentification');
  ok((await call({ method: 'GET', url: '/api/publish', headers: {} })).statusCode === 405, 'GET -> 405');
  ok((await call(req(VALID, {}))).statusCode === 401, 'sans en-tête Bearer -> 401');
  ok((await call(req(VALID, { authorization: 'Bearer FAUX' }))).statusCode === 401, 'mauvais secret -> 401');

  section('Validation & configuration');
  ok((await call(req({ schemaVersion: 2 }, AUTH))).statusCode === 400, 'schéma invalide -> 400 (avant tout appel réseau)');
  delete process.env.GITHUB_TOKEN; delete process.env.GITHUB_REPO;
  ok((await call(req(VALID, AUTH))).statusCode === 500, 'GITHUB_TOKEN/REPO absents -> 500 (config incomplète)');

  process.env.GITHUB_TOKEN = 'ghtok'; process.env.GITHUB_REPO = 'owner/repo'; process.env.GITHUB_BRANCH = 'main';

  section('Écriture GitHub (mockée)');
  var calls = installFetch([{ status: 404 }, { status: 201, body: { commit: { sha: 'newsha' } } }]);
  var rCreate = await call(req(VALID, AUTH));
  var putCreate = JSON.parse(calls[1].opts.body);
  ok(rCreate.statusCode === 200 && rCreate.json().ok === true, 'création (GET 404 -> PUT 201) -> 200 ok');
  ok(!('sha' in putCreate) && calls[1].opts.method === 'PUT', 'PUT de création SANS sha');

  calls = installFetch([{ status: 200, body: { sha: 'oldsha' } }, { status: 200, body: { commit: { sha: 'c2' } } }]);
  var rUpd = await call(req(VALID, AUTH));
  var putUpd = JSON.parse(calls[1].opts.body);
  ok(rUpd.statusCode === 200 && putUpd.sha === 'oldsha', 'mise à jour (GET 200 sha -> PUT) : PUT porte le sha courant');

  calls = installFetch([{ status: 200, body: { sha: 'x' } }, { status: 409 }]);
  ok((await call(req(VALID, AUTH))).statusCode === 409, 'PUT 409/422 -> 409 (édition concurrente)');

  ok((await (async () => { installFetch([{ status: 500 }]); return call(req(VALID, AUTH)); })()).statusCode === 502, 'GET 500 -> 502 (lecture amont échouée)');
  ok((await (async () => { installFetch([{ throw: 'AbortError' }]); return call(req(VALID, AUTH)); })()).statusCode === 504, 'timeout GitHub (AbortError) -> 504');

  section('Lecture robuste du corps (flux, accents multi-octets)');
  var calls2 = installFetch([{ status: 404 }, { status: 201, body: { commit: { sha: 's' } } }]);
  var full = Buffer.from('{"schemaVersion":1,"version":"café"}', 'utf8');
  var cut = full.indexOf(0xC3) + 1;                    // coupe l'octet « é » (0xC3 0xA9) en deux
  var rStream = await call(streamReq([full.slice(0, cut), full.slice(cut)], AUTH));
  var sent = JSON.parse(Buffer.from(JSON.parse(calls2[1].opts.body).content, 'base64').toString('utf8'));
  ok(rStream.statusCode === 200, 'corps en 2 chunks coupant un accent -> 200 (parse OK)');
  ok(sent.version === 'café', 'l\'accent « é » est préservé (Buffer.concat, pas de corruption)');

  process.env.PUBLISH_SECRET = savedSecret; if (savedSecret === undefined) delete process.env.PUBLISH_SECRET;
  process.env.GITHUB_TOKEN = savedTok; if (savedTok === undefined) delete process.env.GITHUB_TOKEN;
  process.env.GITHUB_REPO = savedRepo; if (savedRepo === undefined) delete process.env.GITHUB_REPO;
  process.env.GITHUB_BRANCH = savedBr; if (savedBr === undefined) delete process.env.GITHUB_BRANCH;
  global.fetch = realFetch;

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

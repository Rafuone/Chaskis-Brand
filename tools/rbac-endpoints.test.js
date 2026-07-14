// tools/rbac-endpoints.test.js — enforcement RBAC AU NIVEAU ENDPOINT pour restore/history/perf/
// calendly (publish est couvert dans tools/publish.test.js). Un JWT Clerk RÉEL (RSA + JWKS mocké)
// d'un rôle qui N'A PAS la capacité requise doit recevoir 403 AVANT tout appel externe (GitHub,
// PageSpeed, Calendly). Aucune dépendance, aucun réseau réel.  node tools/rbac-endpoints.test.js
'use strict';

var path = require('path');
var crypto = require('crypto');
var ROOT = path.resolve(__dirname, '..');

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, write: function () {}, end: function (s) { if (s !== undefined) this.body = s; }, json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } } }; }
function loadHandler(rel) { var p = path.join(ROOT, rel); delete require.cache[require.resolve(p)]; return require(p); }

var API = 'test.clerk.accounts.dev';
var kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
var jwk = kp.publicKey.export({ format: 'jwk' }); jwk.kid = 'k1'; jwk.alg = 'RS256'; jwk.use = 'sig';
function b64u(s) { return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uBuf(b) { return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function jwt(sub) {
  var h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
  var p = b64u(JSON.stringify({ sub: sub, iss: 'https://' + API, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return h + '.' + p + '.' + b64uBuf(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), kp.privateKey));
}

// fetch mocké : sert le JWKS ; compte tout AUTRE appel (= appel externe qui n'aurait pas dû avoir lieu).
var externalCalls = 0;
function installFetch() {
  externalCalls = 0;
  global.fetch = async function (url) {
    if (String(url).indexOf('/.well-known/jwks.json') >= 0) return { ok: true, status: 200, json: async function () { return { keys: [jwk] }; } };
    externalCalls++; return { ok: true, status: 200, json: async function () { return {}; } };
  };
}

async function run() {
  var saved = {
    PUBLISH_SECRET: process.env.PUBLISH_SECRET, CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
    CHASKIS_ROLES: process.env.CHASKIS_ROLES, GITHUB_TOKEN: process.env.GITHUB_TOKEN, GITHUB_REPO: process.env.GITHUB_REPO,
    CALENDLY_TOKEN: process.env.CALENDLY_TOKEN, PAGESPEED_KEY: process.env.PAGESPEED_KEY,
  };
  var realFetch = global.fetch;

  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_' + Buffer.from(API + '$').toString('base64');
  process.env.CHASKIS_ROLES = JSON.stringify({ user_ed: 'editor', user_co: 'commercial' });
  // Config amont présente : prouve que le 403 court-circuite AVANT d'y toucher.
  process.env.GITHUB_TOKEN = 'ghtok'; process.env.GITHUB_REPO = 'owner/repo';
  process.env.CALENDLY_TOKEN = 'caltok'; process.env.PAGESPEED_KEY = 'pskey';
  delete process.env.PUBLISH_SECRET; // on force le chemin Clerk (pas de repli clé)

  // Chaque cas : { endpoint, méthode, rôle qui MANQUE la capacité, capacité attendue }.
  var CASES = [
    { name: 'restore', file: 'api/restore.js', method: 'POST', sub: 'user_ed', role: 'editor', need: 'versions.restore', url: '/api/restore', body: { sha: 'abc' } },
    { name: 'history', file: 'api/history.js', method: 'GET', sub: 'user_co', role: 'commercial', need: 'versions.view', url: '/api/history' },
    { name: 'perf', file: 'api/perf.js', method: 'GET', sub: 'user_ed', role: 'editor', need: 'perf.view', url: '/api/perf?url=https://x/&strategy=mobile' },
    { name: 'calendly', file: 'api/calendly.js', method: 'GET', sub: 'user_ed', role: 'editor', need: 'rdv.view', url: '/api/calendly' },
  ];

  section('403 par capacité — rôle sans le droit, AVANT tout appel externe');
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i];
    installFetch();
    var handler = loadHandler(c.file);
    var res = fakeRes();
    var req = { method: c.method, url: c.url, headers: { authorization: 'Bearer ' + jwt(c.sub) }, body: c.body };
    await handler(req, res);
    ok(res.statusCode === 403 && res.json() && res.json().need === c.need, '/' + c.name + ' : ' + c.role + ' -> 403 need ' + c.need + ' (reçu ' + res.statusCode + ')');
    ok(externalCalls === 0, '/' + c.name + ' : aucun appel externe (' + c.name + ' amont non sollicité)');
  }

  section('Contrôle : un rôle QUI A la capacité passe le portail (dépasse le 403)');
  // history requiert versions.view : editor L'A -> ne doit PAS renvoyer 403 (il ira plus loin,
  // ici GitHub mocké renvoie {} -> 200/500 selon parsing, mais surtout PAS 403).
  installFetch();
  var hh = loadHandler('api/history.js');
  var hres = fakeRes();
  await hh({ method: 'GET', url: '/api/history', headers: { authorization: 'Bearer ' + jwt('user_ed') } }, hres);
  ok(hres.statusCode !== 403 && hres.statusCode !== 401, '/history : editor (a versions.view) N\'est PAS bloqué (reçu ' + hres.statusCode + ')');

  Object.keys(saved).forEach(function (k) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  global.fetch = realFetch;

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

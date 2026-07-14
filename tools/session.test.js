// tools/session.test.js — harnais de l'auth admin (api/_lib/session.js).
// Génère une paire de clés RSA, signe un JWT façon Clerk et MOCKE le JWKS : on teste toute la
// vérification RS256 SANS compte Clerk réel ni réseau.  node tools/session.test.js
'use strict';

var path = require('path');
var crypto = require('crypto');
var ROOT = path.resolve(__dirname, '..');

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function load() { delete require.cache[require.resolve(path.join(ROOT, 'api/_lib/session.js'))]; return require(path.join(ROOT, 'api/_lib/session.js')); }
function b64url(s) { return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlBuf(b) { return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

(async function () {
  // 1) Paire RSA + JWK public (avec kid), comme le publierait Clerk dans son JWKS.
  var kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  var jwk = kp.publicKey.export({ format: 'jwk' });
  jwk.kid = 'testkid'; jwk.alg = 'RS256'; jwk.use = 'sig';

  var API = 'test.clerk.accounts.dev';
  var ISS = 'https://' + API;
  function jwt(payload, kid) {
    var h = b64url(JSON.stringify({ alg: 'RS256', kid: kid || 'testkid', typ: 'JWT' }));
    var p = b64url(JSON.stringify(payload));
    var sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), kp.privateKey);
    return h + '.' + p + '.' + b64urlBuf(sig);
  }
  var future = Math.floor(Date.now() / 1000) + 3600;
  var pastExp = Math.floor(Date.now() / 1000) - 3600;

  var savedSecret = process.env.PUBLISH_SECRET, savedPk = process.env.CLERK_PUBLISHABLE_KEY, realFetch = global.fetch;
  process.env.PUBLISH_SECRET = 'sek';
  // publishable key encodant le frontend API (comme Clerk : pk_test_base64("<api>$"))
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_' + Buffer.from(API + '$').toString('base64');
  global.fetch = async function (url) {
    if (String(url).indexOf('/.well-known/jwks.json') >= 0) return { ok: true, status: 200, json: async function () { return { keys: [jwk] }; } };
    return { ok: false, status: 404, json: async function () { return {}; } };
  };

  var S = load();

  section('Dérivation de l\'instance Clerk depuis la publishable key');
  ok(S.clerkFrontendApi() === API, 'clerkFrontendApi() décode ' + API);

  section('Vérification du JWT (RS256, JWKS mocké)');
  S._resetCache();
  ok(await S.verifyClerkJwt(jwt({ sub: 'user_1', iss: ISS, exp: future })) !== null, 'JWT valide accepté');
  ok((await S.verifyClerkJwt(jwt({ sub: 'user_1', iss: ISS, exp: future }))).sub === 'user_1', 'payload renvoyé (sub)');
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: ISS, exp: pastExp })) === null, 'JWT expiré rejeté');
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: ISS, exp: future }, 'autrekid')) === null, 'kid inconnu rejeté');
  var good = jwt({ sub: 'u', iss: ISS, exp: future });
  ok(await S.verifyClerkJwt(good.slice(0, -3) + 'AAA') === null, 'signature altérée rejetée');
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: 'https://evil.example.com', exp: future })) === null, 'émetteur (iss) étranger rejeté');
  ok(await S.verifyClerkJwt('pas.un.jwt') === null, 'jeton malformé rejeté (pas de crash)');

  section('Durcissement (revue de sécurité)');
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: 'https://' + API + '.evil.com', exp: future })) === null, 'iss piégé « …clerk.accounts.dev.evil.com » rejeté (égalité stricte, pas « contient »)');
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: ISS })) === null, 'exp manquant rejeté (exp requis)');
  ok(await S.verifyClerkJwt(jwt({ iss: ISS, exp: future })) === null, 'sub manquant rejeté');
  ok(await S.verifyClerkJwt('abc.def.@@@') === null, 'segment non base64url rejeté');
  process.env.CLERK_ALLOWED_ORIGINS = 'https://admin.chaskis.example';
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: ISS, exp: future, azp: 'https://pirate.example' })) === null, 'azp hors allow-list rejeté');
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: ISS, exp: future, azp: 'https://admin.chaskis.example' })) !== null, 'azp dans allow-list accepté');
  ok(await S.verifyClerkJwt(jwt({ sub: 'u', iss: ISS, exp: future })) !== null, 'azp absent toléré (Bearer déjà immunisé CSRF)');
  delete process.env.CLERK_ALLOWED_ORIGINS;
  process.env.CLERK_ALLOWED_SUBS = 'user_autorise';
  ok(await S.verifyClerkJwt(jwt({ sub: 'user_autorise', iss: ISS, exp: future })) !== null, 'utilisateur (sub) autorisé accepté');
  ok(await S.verifyClerkJwt(jwt({ sub: 'user_intrus', iss: ISS, exp: future })) === null, 'utilisateur (sub) hors allow-list rejeté (verrou serveur)');
  delete process.env.CLERK_ALLOWED_SUBS;

  section('requireAuth — Clerk OU clé partagée');
  var reqWith = function (b) { return { headers: b ? { authorization: 'Bearer ' + b } : {} }; };
  ok(await S.requireAuth(reqWith(good)) === true, 'jeton Clerk valide -> autorisé');
  ok(await S.requireAuth(reqWith('sek')) === true, 'clé PUBLISH_SECRET (repli) -> autorisé');
  ok(await S.requireAuth(reqWith('')) === false, 'sans en-tête -> refusé');
  ok(await S.requireAuth(reqWith('nawak')) === false, 'jeton bidon -> refusé');

  section('Sans Clerk configuré (couture inactive) : repli seul');
  delete process.env.CLERK_PUBLISHABLE_KEY;
  var S2 = load(); S2._resetCache();
  ok(await S2.requireAuth(reqWith('sek')) === true, 'PUBLISH_SECRET marche toujours sans Clerk');
  ok(await S2.requireAuth(reqWith(good)) === false, 'un JWT Clerk est ignoré si Clerk non configuré (pas de faux positif)');

  process.env.PUBLISH_SECRET = savedSecret; if (savedSecret === undefined) delete process.env.PUBLISH_SECRET;
  process.env.CLERK_PUBLISHABLE_KEY = savedPk; if (savedPk === undefined) delete process.env.CLERK_PUBLISHABLE_KEY;
  global.fetch = realFetch;

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

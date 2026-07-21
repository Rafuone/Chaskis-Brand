// tools/crm.test.js — demandes commerciales (api/crm.js) : POST public (capture) + GET (clients.view).
// Sans réseau : storage en MÉMOIRE, auth via PUBLISH_SECRET (principal admin). readJson lit req.body
// s'il est déjà un objet -> pas besoin de simuler un flux. Lancer : node tools/crm.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, end: function (s) { this.body = s; }, json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } } }; }
function loadStorage() { delete require.cache[require.resolve(path.join(ROOT, 'api/_lib/storage.js'))]; return require(path.join(ROOT, 'api/_lib/storage.js')); }
function loadCrm() { delete require.cache[require.resolve(path.join(ROOT, 'api/crm.js'))]; return require(path.join(ROOT, 'api/crm.js')); }

(async function () {
  var saved = { SP: process.env.STORAGE_PROVIDER, SEC: process.env.PUBLISH_SECRET, ROLES: process.env.CHASKIS_ROLES, DEF: process.env.CHASKIS_DEFAULT_ROLE, SUBS: process.env.CLERK_ALLOWED_SUBS };
  process.env.STORAGE_PROVIDER = 'memory';
  process.env.PUBLISH_SECRET = 'sek';
  delete process.env.CHASKIS_ROLES; delete process.env.CHASKIS_DEFAULT_ROLE; delete process.env.CLERK_ALLOWED_SUBS;
  var storage = loadStorage(); storage._resetMemory();
  var crm = loadCrm();

  section('leadFromBody — bornes + moyen de recontact requis');
  ok(crm.leadFromBody({ email: 'a@b.ch' }), 'email seul -> demande valide');
  ok(crm.leadFromBody({ phone: '+41 22' }), 'téléphone seul -> demande valide');
  ok(crm.leadFromBody({ company: 'X' }) === null, 'ni email ni téléphone -> null (refusé)');
  ok(crm.leadFromBody({}) === null, 'corps vide -> null');
  var big = crm.leadFromBody({ email: 'a@b.ch', company: 'C'.repeat(200), contact: 'N'.repeat(200), summary: 'S'.repeat(500) });
  ok(big.company.length === 80 && big.contact.length === 80 && big.summary.length === 200, 'champs bornés (80/80/200)');
  ok(crm.leadFromBody({ email: ' a@b.ch \n' }).email === 'a@b.ch', 'email nettoyé (trim + retours ligne retirés)');

  section('BOT_RE — filtre anti-bots');
  ok(crm.BOT_RE.test('python-requests/2.x') && crm.BOT_RE.test('curl/8'), 'bots détectés');
  ok(!crm.BOT_RE.test('Mozilla/5.0 (iPhone) Safari'), 'vrai navigateur non filtré');

  function post(body, ua) { return { method: 'POST', headers: ua ? { 'user-agent': ua } : {}, body: body }; }
  function get(bearer, url) { return { method: 'GET', url: url || '/api/crm', headers: bearer ? { authorization: 'Bearer ' + bearer } : {} }; }

  section('POST /api/crm — capture publique');
  var rBot = fakeRes(); await crm(post({ email: 'a@b.ch' }, 'Googlebot/2.1'), rBot);
  ok(rBot.statusCode === 200 && rBot.json().saved === false, 'bot -> 200 non enregistré');
  var rBad = fakeRes(); await crm(post({ company: 'Sans contact' }), rBad);
  ok(rBad.statusCode === 400, 'ni email ni téléphone -> 400');
  var r1 = fakeRes(); await crm(post({ company: 'Boucherie Dubois', contact: 'Pierre', email: 'pierre@bd.ch', phone: '+41 22 311', summary: 'vélo, express, 2 arrêts' }), r1);
  ok(r1.statusCode === 200 && r1.json().saved === true, '1re demande -> 200 enregistrée');
  var r2 = fakeRes(); await crm(post({ company: 'Fleurs Léa', contact: 'Léa', email: 'lea@fleurs.ch', summary: 'voiture, planifié' }), r2);
  ok(r2.statusCode === 200 && r2.json().saved === true, '2e demande -> 200 enregistrée');
  var stored = (await storage.list('leads/', 1000)).blobs.length;
  ok(stored === 2, 'le stockage contient 2 demandes');

  section('GET /api/crm — liste (capacité clients.view)');
  var g401 = fakeRes(); await crm(get(null), g401);
  ok(g401.statusCode === 401, 'sans auth -> 401');
  var g405 = fakeRes(); await crm({ method: 'PUT', headers: {} }, g405);
  ok(g405.statusCode === 405, 'méthode non gérée -> 405');
  var gOk = fakeRes(); await crm(get('sek'), gOk);
  var jg = gOk.json();
  ok(gOk.statusCode === 200 && Array.isArray(jg.leads) && jg.leads.length === 2, 'admin (clé de repli) -> 200, 2 demandes');
  var emails = jg.leads.map(function (l) { return l.email; }).sort();
  ok(emails[0] === 'lea@fleurs.ch' && emails[1] === 'pierre@bd.ch', 'les 2 demandes reviennent avec leurs emails');
  ok(jg.leads.every(function (l) { return l.receivedAt; }), 'chaque demande porte une date de réception');
  ok(jg.leads.every(function (l) { return l.source === 'commander'; }), 'source par défaut = commander');

  Object.keys(saved).forEach(function (k) { var e = { SP: 'STORAGE_PROVIDER', SEC: 'PUBLISH_SECRET', ROLES: 'CHASKIS_ROLES', DEF: 'CHASKIS_DEFAULT_ROLE', SUBS: 'CLERK_ALLOWED_SUBS' }[k]; if (saved[k] === undefined) delete process.env[e]; else process.env[e] = saved[k]; });
  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR', e); process.exit(2); });

// tools/calendly.test.js — harnais de test du chantier RENDEZ-VOUS (Calendly), SANS dépendance.
//
// Couvre : la cartographie Calendly->RDV (api/_lib/calendly-map), l'attribution
// (api/_lib/assign), la couture disponibilité (api/_lib/availability) et l'endpoint
// GET /api/calendly (api/calendly) avec une fausse API Calendly (fetch mocké) — y
// compris pagination, échec d'un appel /invitees, et honnêteté du fournisseur de dispo.
// Aucun réseau, aucune clé, aucun compte requis.
//
// Lancer :   node tools/calendly.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var map = require(path.join(ROOT, 'api/_lib/calendly-map'));
var assign = require(path.join(ROOT, 'api/_lib/assign'));
var availability = require(path.join(ROOT, 'api/_lib/availability'));

var pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }
function section(t) { console.log('\n' + t); }

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (s) { this.body = s; },
    json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } },
  };
}
function fakeReq(method, headers) { return { method: method, headers: headers || {}, on: function () {} }; }

async function callCalendly(headers) {
  delete require.cache[require.resolve(path.join(ROOT, 'api/calendly.js'))];
  var handler = require(path.join(ROOT, 'api/calendly.js'));
  var res = fakeRes();
  await handler(fakeReq('GET', headers), res);
  return res;
}

// Fausse API Calendly configurable :
//   cfg.eventsPages : tableau de pages, chaque page = tableau d'événements. La pagination
//                     est simulée via next_page (?page_token=N).
//   cfg.invitees    : { uuid: invitee | 'FAIL' } ('FAIL' => l'appel /invitees renvoie 500).
var API = 'https://api.calendly.com';
function installFakeCalendly(cfg) {
  var real = global.fetch;
  global.fetch = async function (url) {
    if (/\/users\/me$/.test(url)) {
      return { ok: true, status: 200, json: async function () { return { resource: { current_organization: API + '/organizations/ORG1' } }; } };
    }
    if (/\/scheduled_events\?/.test(url)) {
      var m = url.match(/page_token=(\d+)/);
      var idx = m ? parseInt(m[1], 10) : 0;
      var pages = cfg.eventsPages || [[]];
      var coll = pages[idx] || [];
      var next = (idx + 1 < pages.length) ? (API + '/scheduled_events?page_token=' + (idx + 1)) : null;
      return { ok: true, status: 200, json: async function () { return { collection: coll, pagination: { next_page: next } }; } };
    }
    var mm = url.match(/\/scheduled_events\/([^/]+)\/invitees/);
    if (mm) {
      var v = (cfg.invitees || {})[mm[1]];
      if (v === 'FAIL') return { ok: false, status: 500, json: async function () { return {}; } };
      return { ok: true, status: 200, json: async function () { return { collection: v ? [v] : [] }; } };
    }
    return { ok: false, status: 404, json: async function () { return {}; } };
  };
  return function restore() { global.fetch = real; };
}

(async function main() {
  var NOW = Date.parse('2026-07-13T12:00:00Z');

  // =========================================================================
  section('Cartographie Calendly -> RDV');
  var evVisio = {
    uri: API + '/scheduled_events/EV1',
    name: 'Découverte',
    start_time: '2026-07-20T08:00:00Z',
    end_time: '2026-07-20T08:30:00Z',
    status: 'active',
    location: { type: 'google_conference', join_url: 'https://meet.google.com/abc-defg-hij' },
  };
  var invVisio = {
    name: 'Pierre Dubois', email: 'pierre@boucherie-dubois.ch',
    text_reminder_number: '+41 22 311 22 09',
    questions_and_answers: [
      { question: 'Nom de votre entreprise', answer: 'Boucherie Dubois' },
      { question: 'Votre secteur', answer: 'Restauration' },
      { question: 'Volume mensuel de courses', answer: '10 à 30' },
    ],
  };
  var r1 = map.toRdv(evVisio, invVisio, NOW);
  ok(r1.mode === 'visio' && r1.link.indexOf('meet.google.com') >= 0, 'visio : mode + lien de réunion extraits');
  ok(r1.client === 'Boucherie Dubois' && r1.contact === 'Pierre Dubois', 'entreprise -> client, invité -> contact');
  ok(r1.secteur === 'Restauration' && r1.volume === '10 à 30', 'secteur & volume tirés des questions personnalisées');
  ok(r1.tel === '+41 22 311 22 09' && r1.email === 'pierre@boucherie-dubois.ch', 'téléphone & email récupérés');
  ok(r1.st === 'avenir', 'événement actif futur -> à venir');
  ok(r1.endTs > r1.ts, 'end_time cartographié en endTs (> ts)');
  ok(/^\d{2}:\d{2}$/.test(r1.time) && r1.mon === 'juil.' && r1.day === '20', 'date/heure formatées (fuseau suisse) : ' + r1.day + ' ' + r1.mon + ' ' + r1.time);

  // Priorité des mots-clés > ordre des questions (le tel doit venir de la bonne question)
  var invOrder = { name: 'X', questions_and_answers: [{ question: 'Volume', answer: '50' }, { question: 'Numéro de téléphone', answer: '+41 21 000 00 00' }] };
  ok(map.qa(invOrder, ['téléphone', 'numéro']) === '+41 21 000 00 00', 'qa : priorité mot-clé, insensible à l\'ordre des questions');

  var evTel = { uri: 'x/EV2', name: 'Suivi', start_time: '2026-07-01T09:00:00Z', status: 'active', location: { type: 'outbound_call' } };
  ok(map.toRdv(evTel, { name: 'A' }, NOW).mode === 'tel', 'appel sortant -> mode tel');
  ok(map.toRdv(evTel, { name: 'A' }, NOW).st === 'honore', 'événement actif passé -> honoré (défaut modifiable)');
  ok(map.toRdv(evTel, { name: 'A' }, NOW).endTs === 0, 'end_time absent -> endTs=0 (repli durée par défaut à l\'attribution)');
  var evCancel = { uri: 'x/EV3', name: 'Découverte', start_time: '2026-07-25T09:00:00Z', status: 'canceled', location: { type: 'zoom_conference', join_url: 'z' } };
  ok(map.toRdv(evCancel, { name: 'B' }, NOW).st === 'annule', 'événement annulé -> annulé');
  ok(map.toRdv({ uri: 'x/E', name: 'X', start_time: 'pas-une-date', location: {} }, null, NOW).ts === 0, 'date invalide -> ts=0 (pas de crash)');

  // =========================================================================
  section('Attribution (répartition maison)');
  var owners = ['Sarah', 'Marc', 'Jean-Christophe'];
  var rdvs = [{ ts: 1 }, { ts: 2 }, { ts: 3 }, { ts: 4 }, { ts: 5 }, { ts: 6 }];
  var assigned = assign.assignBatch(rdvs, owners, function () { return 'unknown'; });
  var counts = {}; assigned.forEach(function (r) { counts[r.who] = (counts[r.who] || 0) + 1; });
  ok(assigned.every(function (r) { return owners.indexOf(r.who) >= 0; }), 'tous les RDV attribués à un commercial connu');
  ok(counts.Sarah === 2 && counts.Marc === 2 && counts['Jean-Christophe'] === 2, 'charge équilibrée (2/2/2)');
  ok(assigned.every(function (r) { return r.assignedBy === 'auto'; }), 'marqués attribués automatiquement');

  var busyMarc = assign.assignBatch([{ ts: 10 }, { ts: 11 }], owners, function (o) { return o === 'Marc' ? 'busy' : 'unknown'; });
  ok(busyMarc.every(function (r) { return r.who !== 'Marc'; }), 'commercial occupé (busy) exclu de l\'attribution');

  var nobody = assign.assignBatch([{ ts: 20 }], owners, function () { return 'busy'; });
  ok(owners.indexOf(nobody[0].who) >= 0, 'personne de libre connu -> on n\'exclut personne (RDV quand même attribué)');

  var seeded = assign.assignBatch([{ ts: 30 }], owners, function () { return 'unknown'; }, { Sarah: 5, Marc: 0, 'Jean-Christophe': 5 });
  ok(seeded[0].who === 'Marc', 'tient compte de la charge de départ (seedCounts) -> va au moins chargé');

  var noOwners = assign.assignBatch([{ ts: 1 }], [], function () { return 'unknown'; });
  ok(noOwners[0].who === '', 'aucun commercial configuré -> who vide (pas de crash)');

  // endTs transmis au checker (fenêtre réelle, pas durée nulle)
  var seenEnd = -1;
  assign.assignBatch([{ ts: 100, endTs: 200 }], owners, function (o, s, e) { seenEnd = e; return 'unknown'; });
  ok(seenEnd === 200, 'la fenêtre de dispo utilise endTs (borne de fin réelle)');

  // =========================================================================
  section('Couture disponibilité (honnêteté du fournisseur)');
  var sGA = process.env.GOOGLE_CALENDAR_TOKEN, sAP = process.env.AVAILABILITY_PROVIDER;
  delete process.env.AVAILABILITY_PROVIDER; process.env.GOOGLE_CALENDAR_TOKEN = 'tok';
  ok(availability.provider() === 'google', 'provider() reflète la config (google demandé)');
  ok(availability.effectiveProvider() === 'none', 'effectiveProvider()=none tant que google n\'est pas implémenté (pas de faux filtrage)');
  delete process.env.GOOGLE_CALENDAR_TOKEN;
  if (sGA !== undefined) process.env.GOOGLE_CALENDAR_TOKEN = sGA;
  if (sAP !== undefined) process.env.AVAILABILITY_PROVIDER = sAP;

  // =========================================================================
  section('Endpoint GET /api/calendly');
  var savedSecret = process.env.PUBLISH_SECRET, savedToken = process.env.CALENDLY_TOKEN, savedOwners = process.env.CALENDLY_OWNERS, savedGoog = process.env.GOOGLE_CALENDAR_TOKEN;
  process.env.PUBLISH_SECRET = 'sekret';
  process.env.CALENDLY_OWNERS = 'Sarah,Marc,Jean-Christophe';

  delete require.cache[require.resolve(path.join(ROOT, 'api/calendly.js'))];
  var handler = require(path.join(ROOT, 'api/calendly.js'));
  var resPost = fakeRes(); await handler(fakeReq('POST', {}), resPost);
  ok(resPost.statusCode === 405, 'POST -> 405');

  delete process.env.CALENDLY_TOKEN;
  var r401 = await callCalendly({});
  ok(r401.statusCode === 401, 'sans clé Bearer -> 401');
  var r501 = await callCalendly({ authorization: 'Bearer sekret' });
  ok(r501.statusCode === 501, 'clé OK mais CALENDLY_TOKEN absent -> 501 (l\'admin retombe sur la démo)');

  process.env.CALENDLY_TOKEN = 'cal-token';
  var restore = installFakeCalendly({
    eventsPages: [[evVisio, evTel, evCancel]],
    invitees: { EV1: invVisio, EV2: { name: 'Claire', email: 'c@x.ch' }, EV3: { name: 'Bob', email: 'b@x.ch' } },
  });
  var r200 = await callCalendly({ authorization: 'Bearer sekret' });
  restore();
  var j = r200.json();
  ok(r200.statusCode === 200 && j.ok && j.source === 'calendly', '200 + source calendly avec fausse API');
  ok(j.count === 3 && j.rdv.length === 3, '3 événements -> 3 RDV');
  ok(j.truncated === false, 'pas de troncature quand tout tient');
  ok(j.rdv.every(function (r) { return ['Sarah', 'Marc', 'Jean-Christophe'].indexOf(r.who) >= 0; }), 'chaque RDV auto-attribué à un commercial');
  ok(j.rdv[0].client === 'Boucherie Dubois' && j.rdv[0].email === 'pierre@boucherie-dubois.ch', 'données du 1er RDV bien mappées via l\'endpoint');
  ok(j.availabilityProvider === 'none', 'fournisseur de dispo annoncé = none (attribution par équilibrage)');

  // Pagination : 120 événements sur 2 pages -> tout doit remonter (pas de troncature à 100)
  function genEvents(n, from) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push({ uri: 'x/P' + (from + i), name: 'RDV', start_time: '2026-07-15T09:00:00Z', status: 'active', location: { type: 'outbound_call' } });
    return arr;
  }
  var restore2 = installFakeCalendly({ eventsPages: [genEvents(60, 0), genEvents(60, 60)], invitees: {} });
  var rPage = await callCalendly({ authorization: 'Bearer sekret' });
  restore2();
  var jp = rPage.json();
  ok(jp.count === 120 && jp.truncated === false, 'pagination suivie : 120 événements (2 pages) -> 120 RDV, sans perte silencieuse');

  // Échec d'un appel /invitees -> RDV conservé mais marqué incomplet
  var restore3 = installFakeCalendly({ eventsPages: [[evVisio, evTel]], invitees: { EV1: 'FAIL', EV2: { name: 'C' } } });
  var rFail = await callCalendly({ authorization: 'Bearer sekret' });
  restore3();
  var jf = rFail.json();
  var incompletes = jf.rdv.filter(function (r) { return r.incomplete; });
  ok(jf.count === 2 && incompletes.length === 1, 'échec /invitees -> RDV conservé et signalé incomplet (pas de perte muette)');

  // Honnêteté du fournisseur via l'endpoint : GOOGLE_* posé mais non implémenté -> 'none'
  process.env.GOOGLE_CALENDAR_TOKEN = 'tok';
  var restore4 = installFakeCalendly({ eventsPages: [[evTel]], invitees: {} });
  var rProv = await callCalendly({ authorization: 'Bearer sekret' });
  restore4();
  ok(rProv.json().availabilityProvider === 'none', 'GOOGLE_* posé mais non implémenté -> availabilityProvider annoncé = none (pas de faux « filtré »)');
  delete process.env.GOOGLE_CALENDAR_TOKEN;

  process.env.PUBLISH_SECRET = savedSecret; if (savedSecret === undefined) delete process.env.PUBLISH_SECRET;
  if (savedToken !== undefined) process.env.CALENDLY_TOKEN = savedToken; else delete process.env.CALENDLY_TOKEN;
  if (savedOwners !== undefined) process.env.CALENDLY_OWNERS = savedOwners; else delete process.env.CALENDLY_OWNERS;
  if (savedGoog !== undefined) process.env.GOOGLE_CALENDAR_TOKEN = savedGoog; else delete process.env.GOOGLE_CALENDAR_TOKEN;

  // =========================================================================
  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR HARNAIS', e); process.exit(2); });

// tools/collect.test.js — collecteur d'audience maison (api/collect.js). Fonctions pures,
// SANS réseau, SANS dépendance. Lancer : node tools/collect.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var c = require(path.join(ROOT, 'api/collect'));

var pass = 0, fail = 0;
function ok(cond, n) { if (cond) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }

(function () {
  section('eventFromPathname — décode l\'événement encodé dans la clé Blob');
  var ev = { t: 1784550000000, p: '/mobilite', r: 'google.com', l: 'fr', v: 'abc123def456' };
  var b64 = Buffer.from(JSON.stringify(ev), 'utf8').toString('base64url');
  var pathname = 'analytics/ev/2026-07-20/' + b64 + '.a1b2c3d4e5f6';
  var back = c.eventFromPathname(pathname);
  ok(back && back.p === '/mobilite' && back.v === 'abc123def456' && back.r === 'google.com', 'aller-retour clé -> événement');
  ok(c.eventFromPathname('analytics/ev/2026-07-20/@@invalide@@.xx') === null, 'clé illisible -> null (fail-soft)');
  ok(c.eventFromPathname('nimportequoi') === null, 'clé sans encodage -> null');

  section('BOT_RE — filtre anti-bots');
  ['Googlebot/2.1', 'facebookexternalhit/1.1', 'python-requests/2.31', 'HeadlessChrome', 'Lighthouse', 'curl/8.1'].forEach(function (ua) {
    ok(c.BOT_RE.test(ua), 'bot détecté : ' + ua);
  });
  ['Mozilla/5.0 (Windows NT 10.0) Chrome/126 Safari/537', 'Mozilla/5.0 (iPhone) Version/17 Safari', 'Mozilla/5.0 (Macintosh) Firefox/128'].forEach(function (ua) {
    ok(!c.BOT_RE.test(ua), 'vrai navigateur NON filtré : ' + ua.slice(0, 30));
  });

  section('visitorHash — anonyme, déterministe, rotatif par jour');
  var h1 = c.visitorHash('1.2.3.4', 'UA-x', '2026-07-20');
  var h2 = c.visitorHash('1.2.3.4', 'UA-x', '2026-07-20');
  var h3 = c.visitorHash('1.2.3.4', 'UA-x', '2026-07-21');
  var h4 = c.visitorHash('9.9.9.9', 'UA-x', '2026-07-20');
  ok(h1 === h2, 'même IP+UA+jour -> même empreinte (déterministe)');
  ok(h1 !== h3, 'jour différent -> empreinte différente (rotation quotidienne, pas de suivi inter-jours)');
  ok(h1 !== h4, 'IP différente -> empreinte différente');
  ok(/^[0-9a-f]{12}$/.test(h1), 'empreinte = 12 hex (tronquée, non réversible)');
  ok(c.visitorHash('', '', '2026-07-20').length === 12, 'robuste même sans IP/UA');

  section('sanitizePath / sanitizeRef');
  ok(c.sanitizePath('/mobilite?x=1#top') === '/mobilite', 'path : query et ancre retirées');
  ok(c.sanitizePath('') === '/', 'path vide -> /');
  ok(c.sanitizePath('/' + 'a'.repeat(300)).length <= 90, 'path borné à 90');
  ok(c.sanitizeRef('Google.COM/search') === 'google.com', 'ref : minuscule + chars sûrs');
  ok(c.sanitizeRef('<script>') === 'script', 'ref : caractères dangereux retirés');

  section('eventKey — jamais tronquée par cleanKey (anti-perte d\'événements)');
  var storage = require(path.join(ROOT, 'api/_lib/storage'));
  // Événement au pire cas (chemin + referrer longs) : la clé doit tenir sous MAX_KEY ET rester
  // décodable APRÈS passage par cleanKey (ce que fait storage.put à l'écriture).
  var evMax = { t: 1784550000000, p: '/' + 'a'.repeat(200), r: 'x'.repeat(200) + '.com', l: 'fr', v: 'abcdef123456' };
  var k = c.eventKey(evMax, '2026-07-20');
  ok(k.length <= c.MAX_KEY, 'clé pire-cas <= MAX_KEY (' + k.length + ')');
  ok(storage.cleanKey(k) === k, 'clé inchangée par cleanKey (aucune troncature)');
  var decoded = c.eventFromPathname(storage.cleanKey(k));
  ok(decoded && typeof decoded.t === 'number' && decoded.v === 'abcdef123456', 'événement pire-cas TOUJOURS décodable (pas de perte silencieuse)');
  var kShort = c.eventKey({ t: 1784550000000, p: '/mobilite', r: 'google.com', l: 'fr', v: 'abcdef123456' }, '2026-07-20');
  ok(c.eventFromPathname(kShort).p === '/mobilite', 'clé courte : round-trip conservé intégralement');

  section('eventFromPathname — exige un t numérique fini (anti-500 latent)');
  var badT = 'analytics/ev/2026-07-20/' + Buffer.from(JSON.stringify({ p: '/x', v: 'z', t: 'pasunnombre' }), 'utf8').toString('base64url') + '.aabbcc';
  ok(c.eventFromPathname(badT) === null, 't non numérique -> null (rejeté)');

  section('clientIp — priorité aux en-têtes de plateforme (anti-spoof du 1er saut XFF)');
  ok(c.clientIp({ headers: { 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }) === '9.9.9.9', 'x-real-ip prioritaire');
  ok(c.clientIp({ headers: { 'x-forwarded-for': 'spoofed, 2.2.2.2, 3.3.3.3' } }) === '3.3.3.3', 'sans x-real-ip : dernier saut XFF (pas le 1er, spoofable)');

  console.log('\n' + (fail ? ('❌ ' + fail + ' échec(s), ' + pass + ' ok') : ('✅ ' + pass + ' réussis, 0 échoués')));
  process.exit(fail ? 1 : 0);
})();

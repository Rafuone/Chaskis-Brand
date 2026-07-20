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
  ok(c.sanitizePath('/' + 'a'.repeat(300)).length <= 120, 'path borné à 120');
  ok(c.sanitizeRef('Google.COM/search') === 'google.com', 'ref : minuscule + chars sûrs');
  ok(c.sanitizeRef('<script>') === 'script', 'ref : caractères dangereux retirés');

  console.log('\n' + (fail ? ('❌ ' + fail + ' échec(s), ' + pass + ' ok') : ('✅ ' + pass + ' réussis, 0 échoués')));
  process.exit(fail ? 1 : 0);
})();

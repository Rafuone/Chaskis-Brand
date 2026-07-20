// tools/schema.test.js — harnais du validateur de contenu (api/_lib/content-schema.js).
// C'est la SEULE barrière anti-XSS / anti-pollution avant écriture de site-content.json.
// SANS dépendance, SANS réseau.  Lancer : node tools/schema.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var { validateContent, SCHEMA_VERSION } = require(path.join(ROOT, 'api/_lib/content-schema'));

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
var accepts = function (o) { return validateContent(o).ok === true; };
var rejects = function (o) { return validateContent(o).ok === false; };

(function () {
  section('Cas valides');
  ok(SCHEMA_VERSION === 1, 'SCHEMA_VERSION = 1');
  ok(accepts({ schemaVersion: 1 }), 'objet minimal { schemaVersion:1 }');
  ok(accepts({
    schemaVersion: 1, version: 'V12', updatedBy: 'Alex',
    pricing: { days: 22, express: 9, promos: [{ code: 'BIENVENUE', pct: 15 }] },
    testimonials: [{ name: 'A', role: 'B', quote: 'C' }],
    pages: { accueil: { i18n: { fr: { 'hero.overline': 'Livraison à Genève' }, en: { 'hero.overline': 'Delivery' } } } },
    chatbot: { botName: 'Chaski', tone: 'pro', forbidden: ['politique'], sources: [{ title: 'FAQ', tags: ['prix'], text: 'Nos tarifs...' }] }
  }), 'objet complet (pricing + pages i18n + chatbot + sources)');
  ok(accepts({ schemaVersion: 1, version: 'prix < 2h, j\'aime <3' }), '« < » non suivi d\'un nom de balise = autorisé (pas une balise)');

  section('Rejets — structure');
  ok(rejects(null), 'racine non-objet');
  ok(rejects({ schemaVersion: 2 }), 'schemaVersion != 1');
  ok(rejects({ schemaVersion: 1, inconnue: 1 }), 'clé racine hors allowlist');
  ok(rejects({ schemaVersion: 1, pricing: { totalementFaux: 1 } }), 'clé pricing inconnue');
  ok(rejects({ schemaVersion: 1, pages: { pageFantome: { i18n: { fr: {} } } } }), 'page hors allowlist');
  ok(rejects({ schemaVersion: 1, chatbot: { cleBidon: 'x' } }), 'clé chatbot inconnue');
  ok(rejects({ schemaVersion: 1, chatbot: { forbidden: 'pas-un-tableau' } }), 'chatbot.forbidden doit être un tableau');

  section('Rejets — sécurité');
  ok(rejects({ schemaVersion: 1, version: '<script>alert(1)</script>' }), 'balise HTML dans une chaîne');
  ok(rejects({ schemaVersion: 1, pages: { accueil: { i18n: { fr: { x: '<img src=x onerror=alert(1)>' } } } } }), 'balise <img> dans une valeur i18n');
  ok(rejects({ schemaVersion: 1, version: 'cliquez javascript:alert(1)' }), 'URL javascript:');
  ok(rejects({ schemaVersion: 1, version: 'data:text/html,<b>x' }), 'data:text/html');
  ok(rejects(JSON.parse('{"schemaVersion":1,"pricing":{"__proto__":{"a":1}}}')), 'clé __proto__ (pollution de prototype)');
  ok(rejects({ schemaVersion: 1, pricing: { days: Infinity } }), 'nombre Infinity (non sérialisable proprement)');
  ok(rejects({ schemaVersion: 1, version: 'x'.repeat(400 * 1024) }), 'document > 300 Ko');

  section('Images publiées (pages.<page>.images)');
  ok(accepts({ schemaVersion: 1, pages: { accueil: { images: { 'assets/img/hero.webp': 'https://x.public.blob.vercel-storage.com/media/hero-abc.webp' } } } }), 'remplacement d\'image par URL https accepté');
  ok(accepts({ schemaVersion: 1, pages: { accueil: { i18n: { fr: { 'hero.h1': 'X' } }, images: { 'a.png': 'https://x.public.blob.vercel-storage.com/media/a.png' } } } }), 'i18n + images ensemble sur une page');
  ok(rejects({ schemaVersion: 1, pages: { accueil: { images: { 'a.png': 'data:image/png;base64,AAAA' } } } }), 'valeur dataURL rejetée (doit passer par le stockage)');
  ok(rejects({ schemaVersion: 1, pages: { accueil: { images: { 'a.png': 'http://x/insecure.png' } } } }), 'URL http (non https) rejetée');
  ok(rejects({ schemaVersion: 1, pages: { accueil: { images: 'pas-un-objet' } } }), 'images doit être un objet');
  ok(rejects({ schemaVersion: 1, pages: { accueil: { images: { 'a.png': 123 } } } }), 'valeur non-chaîne rejetée');
  ok(rejects({ schemaVersion: 1, pages: { accueil: { autre: {} } } }), 'clé de page hors {i18n, images} rejetée');

  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})();

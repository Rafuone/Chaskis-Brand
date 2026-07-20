// tools/media.test.js — validation de l'upload média (api/media-upload.js → validateUpload).
// SANS réseau, SANS dépendance. Lancer : node tools/media.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var mu = require(path.join(ROOT, 'api/media-upload'));
var validateUpload = mu.validateUpload;

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }

var pngB64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64');

(function () {
  section('Rejets');
  ok(!validateUpload(null).ok, 'corps null rejeté');
  ok(!validateUpload({ contentType: 'application/zip', dataBase64: pngB64 }).ok, 'type non autorisé rejeté');
  ok(!validateUpload({ contentType: 'image/png', dataBase64: '@@@notbase64@@@' }).ok, 'base64 invalide rejeté');
  ok(!validateUpload({ contentType: 'image/png', dataBase64: '' }).ok, 'vide rejeté');
  var big = Buffer.alloc(mu.MAX_BYTES + 1024, 7).toString('base64');
  ok(!validateUpload({ contentType: 'image/png', dataBase64: big }).ok, 'fichier > 2 Mo rejeté');

  section('Acceptations');
  var v = validateUpload({ contentType: 'image/png', dataBase64: pngB64, filename: 'Ma Photo (1).PNG' });
  ok(v.ok && Buffer.isBuffer(v.buffer), 'PNG valide -> buffer décodé');
  ok(v.contentType === 'image/png', 'contentType normalisé');
  ok(/^media\/.+\.png$/.test(v.key), 'clé = media/<nom>.png : ' + v.key);
  ok(v.key.indexOf('..') < 0 && v.key.indexOf(' ') < 0, 'nom de fichier assaini (pas d\'espace ni ..)');

  var v2 = validateUpload({ contentType: 'image/webp; charset=binary', dataBase64: 'data:image/webp;base64,' + pngB64, filename: '../../evil.webp' });
  ok(v2.ok, 'préfixe dataURL toléré + charset dans contentType');
  ok(v2.key.indexOf('..') < 0, 'traversée ../ neutralisée dans la clé : ' + v2.key);
  ok(v2.key.slice(-5) === '.webp', 'extension webp d\'après le type');

  var v3 = validateUpload({ contentType: 'image/svg+xml', dataBase64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64'), filename: 'logo.svg' });
  ok(v3.ok && v3.key.slice(-4) === '.svg', 'SVG accepté -> .svg');

  console.log('\n' + (fail ? ('❌ ' + fail + ' échec(s), ' + pass + ' ok') : ('✅ ' + pass + ' réussis, 0 échoués')));
  process.exit(fail ? 1 : 0);
})();

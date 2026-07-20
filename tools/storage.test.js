// tools/storage.test.js — couture de stockage (api/_lib/storage.js). SANS réseau (fetch mocké),
// SANS dépendance. Couvre : sélection de fournisseur, nettoyage de clé, round-trip mémoire, et le
// chemin Blob REST (upload/lecture d'erreur/suppression) avec fetch simulé. Lancer : node tools/storage.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var storage = require(path.join(ROOT, 'api/_lib/storage'));

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }

// Réinitialise l'environnement de stockage entre les cas.
function resetEnv() {
  delete process.env.STORAGE_PROVIDER;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_API_VERSION;
  storage._resetMemory();
}

// Faux fetch : renvoie une réponse programmée + capture le dernier appel.
var lastFetch = null;
function mockFetch(status, bodyObjOrText) {
  global.fetch = function (url, opts) {
    lastFetch = { url: url, opts: opts || {} };
    var text = typeof bodyObjOrText === 'string' ? bodyObjOrText : JSON.stringify(bodyObjOrText);
    return Promise.resolve({ ok: status >= 200 && status < 300, status: status, text: function () { return Promise.resolve(text); } });
  };
}

(async function () {
  section('provider() — sélection par ENV + défaut');
  resetEnv();
  ok(storage.provider() === 'memory', 'sans token ni ENV -> memory (défaut local/tests)');
  process.env.BLOB_READ_WRITE_TOKEN = 'tok_test';
  ok(storage.provider() === 'blob', 'avec BLOB_READ_WRITE_TOKEN -> blob (défaut)');
  process.env.STORAGE_PROVIDER = 'memory';
  ok(storage.provider() === 'memory', 'STORAGE_PROVIDER=memory force memory (override)');
  process.env.STORAGE_PROVIDER = 'off';
  ok(storage.provider() === 'off', 'STORAGE_PROVIDER=off respecté');
  process.env.STORAGE_PROVIDER = 'nimportequoi';
  ok(storage.provider() === 'blob', 'valeur inconnue -> repli sur défaut (token présent -> blob)');

  section('cleanKey() — anti-traversée / caractères sûrs');
  ok(storage.cleanKey('/a/b.txt') === 'a/b.txt', 'slash de tête retiré');
  ok(storage.cleanKey('../../etc/passwd').indexOf('..') < 0, 'traversée .. neutralisée');
  ok(storage.cleanKey('a//b///c') === 'a/b/c', 'slashs multiples réduits');
  ok(/^[A-Za-z0-9._/\-]+$/.test(storage.cleanKey('mé dia (1)!.png')), 'caractères douteux remplacés');
  ok(storage.cleanKey('') === 'file', 'clé vide -> "file"');

  section('memory — round-trip put/readUrl/list/del');
  resetEnv(); process.env.STORAGE_PROVIDER = 'memory';
  var pm = await storage.put('media/photo.txt', 'coucou', { contentType: 'text/plain' });
  ok(pm.ok && pm.url === 'memory://media/photo.txt', 'put mémoire ok + url mémoire');
  var rm = await storage.readUrl(pm.url);
  ok(rm.ok && rm.text === 'coucou', 'readUrl mémoire renvoie le contenu');
  var lm = await storage.list('media/');
  ok(lm.ok && lm.blobs.length === 1 && lm.blobs[0].pathname === 'media/photo.txt', 'list mémoire filtre par prefix');
  var dm = await storage.del(pm.url);
  var lm2 = await storage.list('media/');
  ok(dm.ok && lm2.blobs.length === 0, 'del mémoire supprime');

  section('blob — chemin REST (fetch simulé)');
  resetEnv(); process.env.STORAGE_PROVIDER = 'blob'; process.env.BLOB_READ_WRITE_TOKEN = 'tok_test';
  mockFetch(200, { url: 'https://x.public.blob.vercel-storage.com/media/a-abc.png', downloadUrl: 'https://x.public.blob.vercel-storage.com/media/a-abc.png?download=1', pathname: 'media/a-abc.png', contentType: 'image/png' });
  var pb = await storage.put('media/a.png', Buffer.from([1, 2, 3]), { contentType: 'image/png', addRandomSuffix: true });
  ok(pb.ok && /public\.blob\.vercel-storage\.com/.test(pb.url), 'put blob -> url publique renvoyée');
  ok(lastFetch.opts.method === 'PUT' && /blob\.vercel-storage\.com\/media\/a\.png$/.test(lastFetch.url), 'PUT sur le bon endpoint');
  ok(lastFetch.opts.headers['authorization'] === 'Bearer tok_test', 'en-tête Authorization Bearer <token>');
  ok(lastFetch.opts.headers['x-content-type'] === 'image/png', 'en-tête x-content-type');
  ok(lastFetch.opts.headers['x-add-random-suffix'] === '1', 'en-tête x-add-random-suffix');
  ok(lastFetch.opts.headers['x-api-version'] === '7', 'x-api-version par défaut = 7');

  mockFetch(403, { error: { message: 'Forbidden' } });
  var pe = await storage.put('media/b.png', 'x', { contentType: 'image/png' });
  ok(!pe.ok && pe.status === 403 && /Forbidden/.test(pe.error), 'erreur HTTP -> { ok:false, status, error } (pas d\'exception)');

  mockFetch(200, { ok: true });
  var db = await storage.del('https://x.public.blob.vercel-storage.com/media/a-abc.png');
  ok(db.ok && lastFetch.opts.method === 'POST' && /\/delete$/.test(lastFetch.url), 'del -> POST /delete');
  ok(JSON.parse(lastFetch.opts.body).urls.length === 1, 'del envoie { urls:[...] }');

  process.env.BLOB_API_VERSION = '9';
  mockFetch(200, { url: 'u', pathname: 'p' });
  await storage.put('c.png', 'x', {});
  ok(lastFetch.opts.headers['x-api-version'] === '9', 'BLOB_API_VERSION surcharge la version (config, pas code)');

  section('off — désactivé');
  resetEnv(); process.env.STORAGE_PROVIDER = 'off';
  var po = await storage.put('x', 'y', {});
  ok(!po.ok && /désactivé/.test(po.error), 'put off -> { ok:false }');

  console.log('\n' + (fail ? ('❌ ' + fail + ' échec(s), ' + pass + ' ok') : ('✅ ' + pass + ' réussis, 0 échoués')));
  process.exit(fail ? 1 : 0);
})();

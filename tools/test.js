// tools/test.js — lanceur de tests unifié, SANS dépendance (Node 18+).
//
// Découvre et exécute tous les harnais tools/*.test.js dans des processus isolés,
// puis agrège le résultat. Aucune dépendance npm, aucun framework : c'est le point
// d'entrée unique pour la CI ou un développeur qui reprend le projet.
//
//   node tools/test.js
//
// Sortie non nulle si au moins un test échoue (utilisable tel quel en CI / Azure Pipelines).
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var TOOLS = __dirname;
var files = fs.readdirSync(TOOLS)
  .filter(function (f) { return /\.test\.js$/.test(f); })
  .sort();

if (!files.length) { console.log('Aucun fichier *.test.js trouvé dans tools/.'); process.exit(0); }

console.log('Lancement de ' + files.length + ' suite(s) de tests\n' + '='.repeat(48));

var failed = [];
files.forEach(function (f) {
  var full = path.join(TOOLS, f);
  console.log('\n▶ ' + f);
  var r = cp.spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(f);
});

console.log('\n' + '='.repeat(48));
if (failed.length) {
  console.log('❌ ' + failed.length + ' suite(s) en échec : ' + failed.join(', '));
  process.exit(1);
}
console.log('✅ Toutes les suites sont vertes (' + files.length + ' suites).');

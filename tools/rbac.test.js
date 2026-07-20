// tools/rbac.test.js — modèle de capacités serveur (api/_lib/rbac.js).
// Vérifie que le serveur FAIT RESPECTER le même « qui peut faire quoi » que le client, et que
// l'attribution rôle←utilisateur par ENV (CHASKIS_ROLES / CHASKIS_DEFAULT_ROLE) est correcte et
// non-cassante. Aucune dépendance, aucun réseau.  node tools/rbac.test.js
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
function load() { delete require.cache[require.resolve(path.join(ROOT, 'api/_lib/rbac.js'))]; return require(path.join(ROOT, 'api/_lib/rbac.js')); }

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } }
function section(t) { console.log('\n' + t); }
function P(role) { return { sub: 'x', role: role, via: 'test' }; }

var saved = process.env.CHASKIS_ROLES, savedD = process.env.CHASKIS_DEFAULT_ROLE, savedA = process.env.CLERK_ALLOWED_SUBS;
delete process.env.CHASKIS_ROLES; delete process.env.CHASKIS_DEFAULT_ROLE; delete process.env.CLERK_ALLOWED_SUBS;
var R = load();

section('capsForRole — presets (miroir du client)');
ok(R.capsForRole('admin') === '*', 'admin = « * » (tout)');
ok(R.capsForRole('editor').indexOf('editor.edit') >= 0, 'editor a editor.edit');
ok(R.capsForRole('editor').indexOf('editor.publish') < 0, 'editor N\'A PAS editor.publish (publier = admin/grant)');
ok(R.capsForRole('inconnu').length === 0, 'rôle inconnu = aucune capacité (fail-closed)');

section('can — admin peut tout');
['editor.publish', 'versions.restore', 'rdv.view', 'perf.view', 'users.manage', 'nimporte.quoi'].forEach(function (c) {
  ok(R.can(c, P('admin')), 'admin can ' + c);
});

section('can — editor');
ok(R.can('editor.edit', P('editor')), 'editor can editor.edit');
ok(R.can('versions.view', P('editor')), 'editor can versions.view');
ok(R.can('media.import', P('editor')), 'editor can media.import');
ok(!R.can('editor.publish', P('editor')), 'editor NE peut PAS editor.publish -> 403 sur /api/publish');
ok(!R.can('versions.restore', P('editor')), 'editor NE peut PAS versions.restore -> 403 sur /api/restore');
ok(!R.can('rdv.view', P('editor')), 'editor NE peut PAS rdv.view -> 403 sur /api/calendly');
ok(!R.can('perf.view', P('editor')), 'editor NE peut PAS perf.view -> 403 sur /api/perf');

section('can — commercial');
ok(R.can('rdv.view', P('commercial')), 'commercial can rdv.view');
ok(R.can('rdv.edit', P('commercial')), 'commercial can rdv.edit');
ok(!R.can('editor.publish', P('commercial')), 'commercial NE peut PAS publier');
ok(!R.can('versions.view', P('commercial')), 'commercial NE peut PAS voir l\'historique');
ok(!R.can('perf.view', P('commercial')), 'commercial NE peut PAS voir la performance');

section('can — leadcommercial');
ok(R.can('rdv.assign', P('leadcommercial')), 'lead can rdv.assign');
ok(R.can('stats.view', P('leadcommercial')), 'lead can stats.view');
ok(R.can('rdv.export', P('leadcommercial')), 'lead can rdv.export');
ok(!R.can('editor.publish', P('leadcommercial')), 'lead NE peut PAS publier');
ok(!R.can('versions.restore', P('leadcommercial')), 'lead NE peut PAS restaurer');

section('can — garde-fous');
ok(!R.can('rdv.view', null), 'principal null -> refusé');
ok(!R.can('rdv.view', {}), 'principal sans rôle -> refusé');

section('resolveRole — défaut FAIL-CLOSED selon le verrouillage de l\'instance (revue sécurité)');
// Instance NON verrouillée (CLERK_ALLOWED_SUBS vide) : un sub inconnu NE doit PAS devenir admin.
delete process.env.CLERK_ALLOWED_SUBS;
ok(R.resolveRole('user_alex') === 'none', 'instance ouverte + sub non mappé -> VERROU none (pas d\'escalade)');
ok(R.defaultRole() === 'none', 'defaultRole() = none sans CHASKIS_DEFAULT_ROLE ni CLERK_ALLOWED_SUBS');
// Instance verrouillée (CLERK_ALLOWED_SUBS renseignée) : les comptes de confiance -> admin.
process.env.CLERK_ALLOWED_SUBS = 'user_alex';
ok(R.resolveRole('user_alex') === 'admin', 'instance verrouillée + sub non mappé -> admin (compte de confiance)');
ok(R.defaultRole() === 'admin', 'defaultRole() = admin quand CLERK_ALLOWED_SUBS renseignée');
delete process.env.CLERK_ALLOWED_SUBS;

section('resolveRole — mapping par ENV (CHASKIS_ROLES)');
process.env.CHASKIS_ROLES = JSON.stringify({ user_ed: 'editor', user_co: 'commercial', user_bad: 'sorcier', user_maj: 'Editor' });
ok(R.resolveRole('user_ed') === 'editor', 'user_ed -> editor');
ok(R.resolveRole('user_co') === 'commercial', 'user_co -> commercial');
ok(R.resolveRole('user_maj') === 'editor', 'casse normalisée : "Editor" -> editor (pas de faux verrou)');
ok(R.resolveRole('user_absent') === 'none', 'absent de la carte + instance ouverte -> VERROU none (fail-closed)');

section('resolveRole — FAIL-CLOSED sur mapping explicite invalide (revue sécurité)');
ok(R.resolveRole('user_bad') === 'none', 'sub mappé à un rôle invalide -> VERROU "none" (JAMAIS admin)');
ok(!R.can('rdv.view', P('none')), 'rôle verrou "none" -> aucune capacité');
ok(!R.can('editor.publish', P('none')), 'rôle verrou "none" -> ne peut pas publier');
ok(R.capsForRole('none').length === 0, 'capsForRole("none") = aucune');

section('resolveRole — défaut configurable + robustesse');
process.env.CHASKIS_DEFAULT_ROLE = 'editor';
ok(R.resolveRole('user_absent') === 'editor', 'CHASKIS_DEFAULT_ROLE=editor change le défaut (posture prod recommandée)');
process.env.CHASKIS_DEFAULT_ROLE = 'Commercial';
ok(R.resolveRole('user_absent') === 'commercial', 'CHASKIS_DEFAULT_ROLE casse normalisée');
process.env.CHASKIS_DEFAULT_ROLE = 'nawak';
ok(R.resolveRole('user_absent') === 'none', 'CHASKIS_DEFAULT_ROLE renseigné mais invalide -> VERROU (fail-closed, pas admin)');
delete process.env.CHASKIS_DEFAULT_ROLE;
process.env.CHASKIS_ROLES = '{ ceci n est pas du json';
ok(R.resolveRole('user_ed') === 'none', 'JSON illisible -> ne jette pas, défaut fail-closed none (instance ouverte)');

process.env.CHASKIS_ROLES = saved; if (saved === undefined) delete process.env.CHASKIS_ROLES;
process.env.CHASKIS_DEFAULT_ROLE = savedD; if (savedD === undefined) delete process.env.CHASKIS_DEFAULT_ROLE;
process.env.CLERK_ALLOWED_SUBS = savedA; if (savedA === undefined) delete process.env.CLERK_ALLOWED_SUBS;

console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
process.exit(fail === 0 ? 0 : 1);

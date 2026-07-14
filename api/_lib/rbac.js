// api/_lib/rbac.js — modèle de capacités CÔTÉ SERVEUR (« qui peut faire quoi »).
//
// Miroir FIDÈLE du modèle client (admin/js/editor.js : ROLE_ORDER + DEFAULT_ROLE_CAPS + can()).
// C'est ici la source de vérité APPLIQUÉE : les Functions /api refusent (403) une action dont le
// rôle de l'appelant n'a pas la capacité. Le modèle client ne fait que MASQUER l'UI ; le serveur
// FAIT RESPECTER. Host-agnostique : CommonJS, zéro dépendance, aucun appel réseau.
//
// COUTURE (comme les autres chantiers) :
//  - L'attribution rôle←utilisateur est en ENV (pas en dur) : `CHASKIS_ROLES` = JSON
//    {"<clerk_sub>":"<role>"} — swap de compte/rôle = éditer une variable, pas du code.
//  - Rôle par défaut d'un utilisateur authentifié mais NON mappé : `CHASKIS_DEFAULT_ROLE`
//    (défaut « admin »). Ce défaut « admin » préserve EXACTEMENT le comportement actuel
//    (« tout compte autorisé = accès total ») → activation NON-CASSANTE : le verrou par
//    capacité ne mord que pour les utilisateurs explicitement mappés à un rôle restreint.
//  - La clé partagée PUBLISH_SECRET (break-glass / tests / ?fallback=1) = toujours admin.
'use strict';

// Ordre + rôles connus (mêmes clés que ROLE_ORDER côté admin).
var ROLE_ORDER = ['admin', 'commercial', 'leadcommercial', 'editor'];

// Presets par rôle — MÊME contenu que DEFAULT_ROLE_CAPS (admin/js/editor.js). admin = tout ('*').
// Garder synchronisé avec le client ; une divergence = l'UI montre un bouton que le serveur refuse.
var ROLE_CAPS = {
  admin: '*',
  commercial: ['dashboard.view', 'rdv.view', 'rdv.edit', 'copilot.view'],
  leadcommercial: ['dashboard.view', 'rdv.view', 'rdv.edit', 'rdv.assign', 'rdv.relance', 'rdv.export', 'copilot.view', 'stats.view', 'affiliation.view'],
  editor: ['dashboard.view', 'editor.view', 'editor.edit', 'structure.view', 'media.view', 'media.import', 'media.delete', 'versions.view', 'chatbot.view', 'chatbot.edit']
};

function isRole(r) { return ROLE_ORDER.indexOf(r) >= 0; }

// Capacités d'un rôle : '*' pour admin, tableau sinon, [] pour un rôle inconnu (fail-closed).
function capsForRole(role) {
  if (role === 'admin') return '*';
  return ROLE_CAPS[role] || [];
}

// principal = { sub, role, via }. Vrai si le rôle porte la capacité (admin = toutes).
function can(cap, principal) {
  if (!principal || !principal.role) return false;
  var caps = capsForRole(principal.role);
  return caps === '*' || caps.indexOf(cap) >= 0;
}

// --- Attribution rôle←utilisateur, pilotée par l'ENV (couture, pas de valeurs en dur) ----------

var _mapRaw = null, _map = {};
// Carte { sub -> role } depuis CHASKIS_ROLES (JSON). Défensive : ne jette jamais, ignore les
// entrées mal formées. Cache invalidé quand la variable d'env change (utile pour les tests).
function roleMap() {
  var raw = process.env.CHASKIS_ROLES || '';
  if (raw === _mapRaw) return _map;
  _mapRaw = raw; _map = {};
  try {
    var o = JSON.parse(raw || '{}');
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(function (k) { if (typeof o[k] === 'string' && isRole(o[k])) _map[k] = o[k]; });
    }
  } catch (e) { _map = {}; }
  return _map;
}

// Rôle par défaut d'un utilisateur authentifié non mappé (env, validé, « admin » sinon).
function defaultRole() {
  var d = (process.env.CHASKIS_DEFAULT_ROLE || '').trim();
  return isRole(d) ? d : 'admin';
}

// Résout le rôle d'un `sub` (identifiant Clerk) : mappé si présent et valide, sinon défaut.
function resolveRole(sub) {
  var m = roleMap();
  var r = sub && m[sub];
  return (r && isRole(r)) ? r : defaultRole();
}

module.exports = { ROLE_ORDER: ROLE_ORDER, ROLE_CAPS: ROLE_CAPS, isRole: isRole, capsForRole: capsForRole, can: can, resolveRole: resolveRole, defaultRole: defaultRole };

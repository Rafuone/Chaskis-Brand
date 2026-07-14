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

// Rôle-sentinelle « aucune capacité » : sert de VERROU fail-closed quand une attribution
// explicite est mal orthographiée. capsForRole('none') = [] -> can() renvoie toujours faux.
var LOCKED = 'none';

var _mapRaw = null, _map = {};
// Carte { sub -> role } depuis CHASKIS_ROLES (JSON). Défensive : ne jette jamais.
// SÉCURITÉ (revue) : un `sub` EXPLICITEMENT mappé mais à un rôle INVALIDE (faute de frappe,
// rôle inconnu) est VERROUILLÉ ('none'), PAS retombé sur le défaut admin — sinon une coquille
// dans la config escaladerait silencieusement un compte restreint vers admin. La casse est
// normalisée ("Editor" -> "editor") pour éviter les faux verrous. Cache invalidé au changement
// d'env (tests / redéploiement).
function roleMap() {
  var raw = process.env.CHASKIS_ROLES || '';
  if (raw === _mapRaw) return _map;
  _mapRaw = raw; _map = {};
  try {
    var o = JSON.parse(raw || '{}');
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      Object.keys(o).forEach(function (k) {
        if (typeof o[k] !== 'string') return;               // valeur non-texte : entrée ignorée
        var rv = o[k].trim().toLowerCase();
        _map[k] = isRole(rv) ? rv : LOCKED;                 // rôle inconnu -> VERROU (jamais admin)
      });
    }
  } catch (e) { _map = {}; }
  return _map;
}

// Rôle par défaut d'un utilisateur authentifié NON mappé.
//  - CHASKIS_DEFAULT_ROLE absent  -> 'admin' (préserve le comportement actuel : NON-CASSANT).
//  - CHASKIS_DEFAULT_ROLE valide   -> ce rôle (posture prod recommandée : un rôle restreint).
//  - CHASKIS_DEFAULT_ROLE renseigné mais INVALIDE -> VERROU ('none'), pas admin (fail-closed :
//    une coquille sur un réglage volontaire ne doit pas ouvrir l'accès total).
function defaultRole() {
  var raw = process.env.CHASKIS_DEFAULT_ROLE;
  if (raw == null || String(raw).trim() === '') return 'admin';
  var d = String(raw).trim().toLowerCase();
  return isRole(d) ? d : LOCKED;
}

// Résout le rôle d'un `sub` (identifiant Clerk) : s'il est EXPLICITEMENT mappé, ce rôle gagne
// (y compris le verrou 'none' d'une coquille) ; sinon le rôle par défaut.
function resolveRole(sub) {
  var m = roleMap();
  if (sub && Object.prototype.hasOwnProperty.call(m, sub)) return m[sub];
  return defaultRole();
}

module.exports = { ROLE_ORDER: ROLE_ORDER, ROLE_CAPS: ROLE_CAPS, LOCKED: LOCKED, isRole: isRole, capsForRole: capsForRole, can: can, resolveRole: resolveRole, defaultRole: defaultRole };

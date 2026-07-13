// api/_lib/availability.js — COUTURE « disponibilité d'un commercial sur un créneau ».
//
// C'est le point où l'attribution automatique lit l'agenda pour n'envoyer un RDV qu'à
// quelqu'un de réellement libre. Volontairement derrière une couture : le fournisseur
// se change sans toucher au reste.
//   - 'none' (défaut, aucun compte requis) : disponibilité inconnue -> personne n'est
//     exclu, l'attribution se fait par simple équilibrage (voir assign.js). Le chatbot
//     RDV reste donc pleinement testable en plan Calendly GRATUIT.
//   - 'google' (Phase 2) : API Google Calendar freebusy (secrets GOOGLE_* côté serveur).
//   - cible Azure : Microsoft 365 / Outlook via le MÊME contrat getBusyChecker().
//
// Les secrets ne vivent QUE côté serveur (process.env), jamais dans le client.
// Convention projet : CommonJS, aucune dépendance. Voir docs/rdv-calendly.md.
'use strict';

// Fournisseurs RÉELLEMENT implémentés. 'google' n'y sera qu'une fois la Phase 2 codée.
// Tant qu'un fournisseur n'est pas là, on ne prétend PAS filtrer les disponibilités.
var IMPLEMENTED = { none: true };

// Fournisseur DEMANDÉ (par config/env). Peut valoir 'google' avant même son implémentation.
function provider() {
  var p = (process.env.AVAILABILITY_PROVIDER || '').trim().toLowerCase();
  if (p) return p;
  return (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CALENDAR_TOKEN) ? 'google' : 'none';
}

// Fournisseur EFFECTIVEMENT actif : ce que l'endpoint doit annoncer. Si le fournisseur
// demandé n'est pas encore implémenté, on retombe honnêtement sur 'none' (aucun filtrage,
// donc l'attribution se fait par simple équilibrage — pas de faux « c'est filtré »).
function effectiveProvider() {
  var p = provider();
  return IMPLEMENTED[p] ? p : 'none';
}

// Renvoie une fonction (ownerName, startTs, endTs) -> 'free' | 'busy' | 'unknown'.
// Async pour préparer un vrai appel réseau (Google) sans changer la signature côté
// appelant. Le défaut ne bloque personne (comportement sûr : mieux vaut attribuer que
// laisser un RDV orphelin).
async function getBusyChecker(/* owners, rangeStartTs, rangeEndTs */) {
  if (effectiveProvider() === 'google') {
    // Phase 2 : appeler https://www.googleapis.com/calendar/v3/freeBusy avec les
    // identifiants GOOGLE_* (service account ou jeton), mapper chaque commercial vers son
    // calendarId, et renvoyer 'busy'/'free'. À activer en ajoutant 'google' à IMPLEMENTED
    // une fois codé (sinon, ci-dessous, on ne bloque personne).
    return function () { return 'unknown'; };
  }
  return function () { return 'unknown'; };
}

module.exports = { provider: provider, effectiveProvider: effectiveProvider, getBusyChecker: getBusyChecker };

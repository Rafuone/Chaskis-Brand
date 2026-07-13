// api/_lib/assign.js — ATTRIBUTION des RDV, PURE et testable.
//
// La répartition entre commerciaux se fait ICI (chez nous), pas via le round-robin
// de Calendly (qui, lui, imposerait le plan Teams + un siège payant par personne).
// On garde donc un seul calendrier Calendly central, et on redistribue nous-mêmes :
//   - par défaut : automatiquement, vers le commercial DISPONIBLE le moins chargé ;
//   - l'admin / lead commercial peut toujours réattribuer à la main (côté interface).
//
// availabilityFn(ownerName, startTs, endTs) -> 'free' | 'busy' | 'unknown'
//   'unknown' (défaut, tant que Google Agenda n'est pas branché) = candidat retenu.
//
// Convention projet : CommonJS, aucune dépendance. Voir api/_lib/availability.js.
'use strict';

// Attribue un lot de RDV. Équilibre la charge (moins chargé d'abord), en n'excluant
// que les commerciaux explicitement 'busy' sur le créneau. Déterministe (ordre stable).
// seedCounts : charge de départ éventuelle (ex. RDV déjà attribués manuellement) pour
// que l'auto-répartition en tienne compte.
function assignBatch(rdvs, owners, availabilityFn, seedCounts) {
  owners = Array.isArray(owners) ? owners.filter(Boolean) : [];
  var counts = Object.create(null);
  owners.forEach(function (o) { counts[o] = (seedCounts && seedCounts[o]) || 0; });
  var fn = (typeof availabilityFn === 'function') ? availabilityFn : function () { return 'unknown'; };

  return (rdvs || []).map(function (r) {
    if (!owners.length) return Object.assign({}, r, { who: '', assignedBy: 'auto' });
    var end = r.endTs || (r.ts + 30 * 60 * 1000); // repli 30 min si la fin n'est pas connue
    var cands = owners.filter(function (o) { return fn(o, r.ts, end) !== 'busy'; });
    if (!cands.length) cands = owners.slice(); // personne de libre connu -> on n'exclut personne
    cands.sort(function (a, b) {
      var d = counts[a] - counts[b];
      return d !== 0 ? d : (owners.indexOf(a) - owners.indexOf(b));
    });
    var pick = cands[0];
    counts[pick] = (counts[pick] || 0) + 1;
    return Object.assign({}, r, { who: pick, assignedBy: 'auto' });
  });
}

module.exports = { assignBatch: assignBatch };

// api/_lib/calendly-map.js — cartographie PURE d'un événement Calendly (API v2) vers
// le format RDV de l'admin. Aucune I/O, aucune clé : entièrement testable.
//
// Format RDV cible (voir admin/js/editor.js, rdvData) :
//   { day, mon, time, ts, client, contact, tel, email, secteur, volume, sujet,
//     mode:'tel'|'visio', link, st:'avenir'|'honore'|'annule', note, who, source, calendlyUri }
//
// Convention projet : CommonJS, aucune dépendance. Voir docs/rdv-calendly.md.
'use strict';

var MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Formate un ISO 8601 en jour/mois court FR/heure, dans le fuseau suisse (Calendly
// renvoie de l'UTC). Renvoie ts=0 si la date est invalide.
function fmtParts(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return { day: '', mon: '', time: '', ts: 0 };
  var parts = {};
  try {
    new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
  } catch (e) {
    parts = { day: String(d.getUTCDate()), month: String(d.getUTCMonth() + 1), hour: ('0' + d.getUTCHours()).slice(-2), minute: ('0' + d.getUTCMinutes()).slice(-2) };
  }
  var monIdx = parseInt(parts.month, 10) - 1;
  return { day: String(parseInt(parts.day, 10)), mon: MONTHS_FR[monIdx] || '', time: (parts.hour + ':' + parts.minute), ts: d.getTime() };
}

// Traduit le type de lieu Calendly en mode 'tel'/'visio' + lien de réunion éventuel.
// Table explicite (pas de mapping naïf) ; défaut prudent = 'tel'.
function mapLocation(loc) {
  var t = (loc && loc.type) || '';
  var visio = ['zoom_conference', 'google_conference', 'microsoft_teams_conference', 'gotomeeting_conference', 'webex_conference'];
  if (visio.indexOf(t) >= 0) return { mode: 'visio', link: (loc && (loc.join_url || loc.location)) || '' };
  if (t === 'outbound_call' || t === 'inbound_call' || t === 'physical') return { mode: 'tel', link: '' };
  return { mode: 'tel', link: (loc && loc.join_url) || '' };
}

// Cherche la réponse d'une question personnalisée par mot-clé. La PRIORITÉ des mots-clés
// prime sur l'ordre des questions (on cherche le 1er mot-clé dans toutes les questions
// avant de passer au suivant), et `exclude` évite les faux positifs (intitulés à écarter).
function qa(invitee, keywords, exclude) {
  var list = (invitee && invitee.questions_and_answers) || [];
  for (var k = 0; k < keywords.length; k++) {
    for (var i = 0; i < list.length; i++) {
      var q = (list[i].question || '').toLowerCase();
      if (q.indexOf(keywords[k]) < 0) continue;
      if (exclude && exclude.some(function (x) { return q.indexOf(x) >= 0; })) continue;
      return list[i].answer || '';
    }
  }
  return '';
}

// Statut : annulé -> 'annule' ; actif futur -> 'avenir' ; actif passé -> 'honore'
// (défaut modifiable à la main dans l'admin ; on n'invente ni 'noshow' ni 'refuse').
function statusOf(ev, ts, nowTs) {
  if ((ev && ev.status) === 'canceled') return 'annule';
  return (ts && ts < nowTs) ? 'honore' : 'avenir';
}

// Événement + premier invité -> objet RDV (sans 'who' : l'attribution est faite après).
function toRdv(ev, invitee, nowTs) {
  ev = ev || {};
  var p = fmtParts(ev.start_time);
  var pEnd = fmtParts(ev.end_time); // ts=0 si end_time absent -> l'attribution appliquera une durée par défaut
  var loc = mapLocation(ev.location);
  var company = qa(invitee, ['entreprise', 'société', 'societe', 'company']);
  var secteur = qa(invitee, ['secteur', 'industry', 'activité', 'activite', 'domaine']);
  var volume = qa(invitee, ['volume', 'courses', 'quantité', 'quantite']);
  var phone = (invitee && invitee.text_reminder_number) || qa(invitee, ['téléphone', 'telephone', 'phone', 'numéro', 'numero', 'tél']);
  return {
    day: p.day, mon: p.mon, time: p.time, ts: p.ts, endTs: pEnd.ts || 0,
    client: company || (invitee && invitee.name) || ev.name || 'Rendez-vous',
    contact: (invitee && invitee.name) || '',
    tel: phone || '',
    email: (invitee && invitee.email) || '',
    secteur: secteur || '',
    volume: volume || '',
    sujet: ev.name || '',
    mode: loc.mode,
    link: loc.link,
    st: statusOf(ev, p.ts, nowTs),
    note: '',
    who: '',
    source: 'calendly',
    calendlyUri: ev.uri || '',
  };
}

module.exports = { toRdv: toRdv, mapLocation: mapLocation, fmtParts: fmtParts, qa: qa, statusOf: statusOf, MONTHS_FR: MONTHS_FR };

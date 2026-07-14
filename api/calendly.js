// api/calendly.js — Vercel Serverless Function, route GET /api/calendly.
//
// Lit les VRAIS rendez-vous du compte Calendly CENTRAL (une seule page de réservation)
// et les renvoie normalisés pour l'admin, avec une ATTRIBUTION AUTO (le commercial
// disponible le moins chargé). La redistribution se fait chez nous, pas via le
// round-robin payant de Calendly -> un seul calendrier suffit.
//
// COMPATIBLE PLAN CALENDLY GRATUIT : on lit via l'API v2 (requêtes GET), on n'utilise
// PAS de webhook (le webhook temps réel exige, lui, un plan payant Standard).
//
// Auth : Bearer PUBLISH_SECRET (comme /api/history) — on n'expose pas des données
// clients sans la clé. Le jeton Calendly vit UNIQUEMENT dans les variables
// d'environnement serveur (CALENDLY_TOKEN), jamais côté client.
//
// Convention projet : CommonJS, réponse Node brute, aucune dépendance (fetch + crypto
// natifs Node 18+). Host-agnostique (Vercel, Azure App Service, Node nu). Voir
// docs/rdv-calendly.md.
//
// Variables d'environnement :
//   PUBLISH_SECRET  : clé partagée (déjà utilisée par publish/history/restore).
//   CALENDLY_TOKEN  : jeton d'accès personnel Calendly (dispo sur plan gratuit).
//   CALENDLY_OWNERS : (optionnel) commerciaux, séparés par des virgules. Défaut : démo.
'use strict';

var { send } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var map = require('./_lib/calendly-map');
var assign = require('./_lib/assign');
var availability = require('./_lib/availability');

var API = 'https://api.calendly.com';
var DAY = 24 * 60 * 60 * 1000;
var GLOBAL_BUDGET_MS = parseInt(process.env.CALENDLY_BUDGET_MS, 10) || 9000;   // réglable par env ; défaut sous le mur ~10 s des Functions Hobby
var PER_REQ_MS = 6000;         // timeout dur par requête, borné aussi par le budget global
var MAX_PAGES = 10;            // garde-fou anti-boucle de pagination (jusqu'à ~1000 RDV)
var PAST_WINDOW = 14 * DAY;    // l'admin prépare surtout le futur : passé réduit = moins d'appels
var FUTURE_WINDOW = 90 * DAY;

// Appel Calendly avec timeout dur = min(PER_REQ_MS, temps restant du budget global).
async function cal(url, token, deadline) {
  var ctrl = new AbortController();
  var budget = Math.max(0, Math.min(PER_REQ_MS, deadline - Date.now()));
  var t = setTimeout(function () { ctrl.abort(); }, budget);
  try {
    return await fetch(url, { headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, signal: ctrl.signal });
  } finally { clearTimeout(t); }
}

function owners() {
  var raw = (process.env.CALENDLY_OWNERS || '').trim();
  if (raw) return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return ['Sarah', 'Marc', 'Jean-Christophe'];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });

  // Auth : session Clerk (JWT) OU clé partagée PUBLISH_SECRET (repli).
  if (!(await requireAuth(req))) return send(res, 401, { error: 'non autorisé' });

  // Calendly non configuré -> 501 : l'admin retombe proprement sur les RDV de démo.
  var token = (process.env.CALENDLY_TOKEN || '').trim();
  if (!token) return send(res, 501, { error: 'Calendly non configuré (CALENDLY_TOKEN absent)' });

  var deadline = Date.now() + GLOBAL_BUDGET_MS;
  var truncated = false;

  try {
    // 1. Organisation de l'utilisateur du jeton.
    var meRes = await cal(API + '/users/me', token, deadline);
    if (meRes.status === 401) return send(res, 502, { error: 'jeton Calendly refusé (401) — vérifiez CALENDLY_TOKEN' });
    if (!meRes.ok) return send(res, 502, { error: 'Calendly /users/me a échoué (' + meRes.status + ')' });
    var me = await meRes.json();
    var org = me && me.resource && me.resource.current_organization;
    if (!org) return send(res, 502, { error: 'organisation Calendly introuvable' });

    // 2. Événements sur une fenêtre bornée, actifs ET annulés, AVEC pagination.
    //    (count=100 est le max Calendly ; au-delà, on suit pagination.next_page — sinon
    //     les RDV les plus lointains disparaîtraient silencieusement.)
    var now = Date.now();
    var min = new Date(now - PAST_WINDOW).toISOString();
    var max = new Date(now + FUTURE_WINDOW).toISOString();
    var nextUrl = API + '/scheduled_events?organization=' + encodeURIComponent(org) +
      '&count=100&min_start_time=' + encodeURIComponent(min) +
      '&max_start_time=' + encodeURIComponent(max) + '&sort=start_time:asc';

    var events = [];
    var page = 0;
    while (nextUrl && page < MAX_PAGES) {
      if (Date.now() > deadline) { truncated = true; break; }
      var evRes = await cal(nextUrl, token, deadline);
      if (!evRes.ok) return send(res, 502, { error: 'liste des rendez-vous Calendly a échoué (' + evRes.status + ')' });
      var evJson = await evRes.json();
      var chunk = (evJson && evJson.collection) || [];
      for (var c = 0; c < chunk.length; c++) events.push(chunk[c]);
      // next_page est une URL absolue déjà signée avec les mêmes filtres : passée telle quelle.
      nextUrl = (evJson && evJson.pagination && evJson.pagination.next_page) || null;
      page++;
    }
    if (nextUrl && page >= MAX_PAGES) truncated = true; // il restait des pages non lues

    // 3. Invités par lots parallèles (borne le N+1 et le temps total). On DISTINGUE
    //    un échec de récupération (RDV marqué incomplet) d'un invité réellement absent.
    var rdvsRaw = [];
    var batchSize = 5;
    for (var i = 0; i < events.length; i += batchSize) {
      if (Date.now() > deadline) { truncated = true; break; }
      var slice = events.slice(i, i + batchSize);
      var invs = await Promise.all(slice.map(async function (ev) {
        try {
          var uuid = (ev.uri || '').split('/').pop();
          if (!uuid) return { invitee: null, failed: false };
          var iRes = await cal(API + '/scheduled_events/' + encodeURIComponent(uuid) + '/invitees?count=1', token, deadline);
          if (!iRes.ok) return { invitee: null, failed: true };
          var iJson = await iRes.json();
          return { invitee: (iJson && iJson.collection && iJson.collection[0]) || null, failed: false };
        } catch (e) { return { invitee: null, failed: true }; }
      }));
      slice.forEach(function (ev, k) {
        var r = map.toRdv(ev, invs[k].invitee, now);
        if (invs[k].failed) r.incomplete = true; // coordonnées non chargées -> l'admin le sait
        rdvsRaw.push(r);
      });
    }

    // 4. Attribution auto : dispo (couture Google en Phase 2) -> moins chargé.
    var own = owners();
    var checker = await availability.getBusyChecker(own, now - PAST_WINDOW, now + FUTURE_WINDOW);
    var rdv = assign.assignBatch(rdvsRaw, own, checker);

    return send(res, 200, {
      ok: true,
      source: 'calendly',
      count: rdv.length,
      truncated: truncated,                                 // true = tout n'a pas pu être lu (volume/temps)
      availabilityProvider: availability.effectiveProvider(), // fournisseur RÉELLEMENT actif
      rdv: rdv,
    });
  } catch (e) {
    var aborted = e && e.name === 'AbortError';
    return send(res, aborted ? 504 : 502, { error: aborted ? 'délai Calendly dépassé' : 'erreur réseau Calendly' });
  }
};

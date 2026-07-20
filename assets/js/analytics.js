// assets/js/analytics.js — mesure d'audience SANS COOKIE, première partie (chantier "analytics", étape 1).
//
// Enregistre les pages vues côté navigateur (localStorage first-party), sans cookie et
// sans service tiers : c'est le « petit outil de mesure sur toutes les pages » du plan.
// Aujourd'hui le stockage est local (par appareil) ; demain, la même mesure pourra être
// envoyée à /api/collect pour l'agrégation multi-visiteurs (voir docs/migration-*).
//
// Ne s'exécute PAS dans l'éditeur (la page est chargée dans une iframe) : on ne compte que
// les vraies visites (fenêtre principale), jamais les prévisualisations de l'admin.
//
// RÈGLE : strictement fail-silent. Un souci ici ne doit jamais gêner l'affichage de la page.
(function () {
  try {
    if (window.top !== window.self) return; // dans l'iframe de l'éditeur : pas une vraie visite

    // --- Umami : agrégation multi-visiteurs, SANS cookie (chantier "analytics", étape 2) ---
    // Chargé UNIQUEMENT en fenêtre principale (le garde-fou anti-iframe ci-dessus évite de
    // compter les prévisualisations de l'admin). L'identifiant est PUBLIC (pas un secret) ;
    // pour changer de compte/fournisseur, il suffit de le remplacer ici (couture unique).
    // Cible Azure possible plus tard : Application Insights ou un /api/collect maison.
    try {
      var UMAMI_ID = 'b94c0a14-a1fb-4127-b7e7-976c74e36127';
      var UMAMI_SRC = 'https://cloud.umami.is/script.js';
      if (UMAMI_ID && !document.querySelector('script[data-website-id]')) {
        var us = document.createElement('script');
        us.defer = true; us.src = UMAMI_SRC; us.setAttribute('data-website-id', UMAMI_ID);
        (document.head || document.documentElement).appendChild(us);
      }
    } catch (e) { /* fail-silent : Umami ne doit jamais gêner la page */ }

    var KEY = 'chaskis_analytics_v1';
    var now = Date.now();
    var store = null;
    try { store = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!store || typeof store !== 'object') store = { events: [], firstAt: now };
    if (!Array.isArray(store.events)) store.events = [];

    var refHost = '';
    try { if (document.referrer) { var u = new URL(document.referrer); if (u.host && u.host !== location.host) refHost = u.host; } } catch (e) {}
    var lang = '';
    try { lang = (document.documentElement.getAttribute('lang') || '').slice(0, 2); } catch (e) {}

    store.events.push({
      t: now,
      p: location.pathname || '/',
      r: refHost,
      l: lang,
      w: (window.innerWidth || 0)
    });
    if (store.events.length > 1000) store.events = store.events.slice(-1000); // garde-fou stockage
    store.lastAt = now;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}

    // Envoi non bloquant au collecteur maison (/api/collect), sans cookie. Agrégation
    // multi-visiteurs côté serveur (api/collect.js : filtre bots + visiteurs uniques anonymes
    // par hash du jour). Fail-silent, ne bloque jamais la page ; ignoré dans l'aperçu éditeur
    // (garde-fou anti-iframe en tête d'IIFE).
    try {
      var beacon = JSON.stringify({ p: location.pathname || '/', r: refHost, l: lang });
      var sent = false;
      // Blob typé application/json : sendBeacon pose alors le bon Content-Type (sinon text/plain).
      if (navigator && typeof navigator.sendBeacon === 'function') {
        try { sent = navigator.sendBeacon('/api/collect', new Blob([beacon], { type: 'application/json' })); } catch (e) {}
      }
      if (!sent && typeof fetch === 'function') { fetch('/api/collect', { method: 'POST', body: beacon, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(function () {}); }
    } catch (e) { /* fail-silent */ }
  } catch (e) { /* fail-silent */ }
})();

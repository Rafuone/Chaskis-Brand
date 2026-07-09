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

    // Étape suivante (quand /api/collect existera) : envoi non bloquant, sans cookie.
    //   try { navigator.sendBeacon('/api/collect', JSON.stringify({ p: location.pathname, r: refHost })); } catch (e) {}
    // Laissé en commentaire tant que l'endpoint n'existe pas (aucun appel réseau aujourd'hui).
  } catch (e) { /* fail-silent */ }
})();

/* Chaskis, Calendly sur la page d'accueil (section #booking).
 *
 * Le calendrier de DÉMONSTRATION sert de placeholder pendant le chargement (et de repli
 * hors-ligne). Dès que le VRAI Calendly a injecté son iframe, il REMPLACE la démo, INLINE
 * dans la carte, en pleine largeur et aux couleurs Chaskis. Aucun popup.
 *
 * Note produit : la disponibilité affichée (nombre de créneaux, plage horaire) se règle
 * côté compte Calendly. En la restreignant, l'agenda paraît actif et crée un effet de
 * rareté (créneaux limités = exclusivité), sans jamais paraître vide, mais les vrais
 * créneaux restent visibles AVANT toute saisie, et Calendly ne demande les coordonnées
 * qu'APRÈS le choix du créneau (aucune barrière à l'engagement).
 *
 * URL publique (assets/js/site-config.js) ; aucun secret ici. Host-agnostique.
 */
(function () {
  var cfg = window.CHASKIS_CONFIG || {};
  var url = (cfg.calendlyUrl || '').trim();
  if (!url) return; // pas d'URL -> la démo reste (aucune réservation réelle branchée)

  var host = document.getElementById('bkW');
  if (!host) return;
  var urg = document.querySelector('#booking .bk-urgency');

  function themed(u) {
    var sep = u.indexOf('?') === -1 ? '?' : '&';
    return u + sep + 'hide_gdpr_banner=1&hide_event_type_details=1&primary_color=4bb3a4';
  }

  // Widget préparé À CÔTÉ, invisible : on ne retire la démo QUE lorsque l'iframe a rendu.
  // Hors-ligne / bloqué : la démo n'est jamais touchée, elle reste vivante.
  var w = document.createElement('div');
  w.className = 'calendly-inline-widget';
  w.setAttribute('data-url', themed(url));
  w.style.width = '100%';      // pleine largeur de la carte (corrige l'ancien widget étroit)
  w.style.minWidth = '280px';
  w.style.height = '640px';
  w.style.display = 'none';
  host.appendChild(w);

  var settled = false;
  function restoreDemo() { if (settled) return; settled = true; if (w.parentNode) w.parentNode.removeChild(w); }
  function confirmed() {
    settled = true;
    Array.prototype.slice.call(host.children).forEach(function (ch) { if (ch !== w) host.removeChild(ch); });
    w.style.display = '';
    if (urg) urg.style.display = 'none'; // la dispo de démo n'a plus de sens à côté du vrai agenda
  }

  if (!document.querySelector('script[data-calendly]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(link);
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    s.setAttribute('data-calendly', '1');
    s.onerror = restoreDemo; // script inaccessible -> on garde la démo
    document.head.appendChild(s);
  }

  // Calendly injecte un <iframe> quand il s'initialise. Présent -> on bascule ; absent après
  // ~10 s (hors-ligne / bloqué) -> on garde le calendrier de démonstration.
  var tries = 0;
  var iv = setInterval(function () {
    if (settled) { clearInterval(iv); return; }
    if (w.querySelector('iframe')) { confirmed(); clearInterval(iv); return; }
    if (++tries >= 40) { clearInterval(iv); restoreDemo(); }
  }, 250);
})();

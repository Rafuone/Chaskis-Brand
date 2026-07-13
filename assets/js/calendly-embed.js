/* Chaskis — embed Calendly sur la page d'accueil (section #booking).
 *
 * Si une URL Calendly est configurée (assets/js/site-config.js), on remplace le
 * calendrier de DÉMONSTRATION (le faux, en 3 étapes) par le VRAI widget Calendly,
 * chargé à la demande. Sinon, on ne touche à rien : le calendrier de démo reste
 * (démo cliente intacte). La logique du faux calendrier (index.js) se neutralise
 * d'elle-même quand ses éléments disparaissent (garde `if(!bkCal||!bkSl) return`).
 *
 * L'URL est publique ; aucun secret ici. Host-agnostique : simple script client,
 * fonctionne sur Vercel comme sur Azure. Voir docs/rdv-calendly.md.
 */
(function () {
  var cfg = window.CHASKIS_CONFIG || {};
  var url = (cfg.calendlyUrl || '').trim();
  if (!url) return; // pas d'URL -> on garde le calendrier de démo

  var host = document.getElementById('bkW');
  if (!host) return;

  // Remplace le faux calendrier par le widget inline Calendly (auto-initialisé par le script).
  host.innerHTML = '';
  var w = document.createElement('div');
  w.className = 'calendly-inline-widget';
  w.setAttribute('data-url', url);
  w.style.minWidth = '320px';
  w.style.height = '660px';
  host.appendChild(w);

  // Masque le badge « prochain créneau » (date de démo) à côté du vrai widget.
  var urg = document.querySelector('#booking .bk-urgency');
  if (urg) urg.style.display = 'none';

  // Charge le script + le style Calendly une seule fois (à la demande).
  if (!document.querySelector('script[data-calendly]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(link);

    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    s.setAttribute('data-calendly', '1');
    document.head.appendChild(s);
  }
})();

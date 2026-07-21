/* Chaskis — Calendly sur la page d'accueil (section #booking).
 *
 * On GARDE le calendrier de DÉMONSTRATION (design maison, cohérent avec le site) comme
 * visuel permanent, et on ouvre le VRAI Calendly en POPUP dès que l'utilisateur veut
 * réserver (clic sur « Suivant » une fois un créneau choisi). Aucun iframe inline :
 * la mise en page et la cohérence graphique de la démo restent intactes.
 *
 * L'URL est publique (assets/js/site-config.js) ; aucun secret ici. Host-agnostique.
 * Voir docs/rdv-calendly.md.
 */
(function () {
  var cfg = window.CHASKIS_CONFIG || {};
  var url = (cfg.calendlyUrl || '').trim();
  if (!url) return; // pas d'URL -> démo seule (aucune réservation réelle branchée)

  var host = document.getElementById('bkW');
  if (!host) return;

  // Popup aux couleurs Chaskis + bannière GDPR masquée.
  function bookingUrl() {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'hide_gdpr_banner=1&primary_color=4bb3a4';
  }

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

  function openBooking() {
    if (window.Calendly && typeof window.Calendly.initPopupWidget === 'function') {
      window.Calendly.initPopupWidget({ url: bookingUrl() });
    } else {
      window.open(url, '_blank', 'noopener'); // filet de sécurité si le script tarde à charger
    }
  }

  // Les boutons « Suivant » de la démo (#bkN1/#bkN2) déclenchent la vraie réservation.
  // Écoute en phase de CAPTURE sur le conteneur : on intercepte AVANT le handler de la démo
  // (qui ferait avancer les fausses étapes), on l'annule, et on ouvre le popup Calendly.
  host.addEventListener('click', function (ev) {
    var btn = ev.target.closest('#bkN1, #bkN2, .bk-nav .btn');
    if (!btn || btn.disabled) return; // « Suivant » reste désactivé tant qu'aucun créneau n'est choisi
    ev.preventDefault();
    ev.stopPropagation(); // empêche la démo d'avancer d'étape : le vrai Calendly prend le relais
    openBooking();
  }, true);
})();

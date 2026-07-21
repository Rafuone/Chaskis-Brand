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

  // IMPORTANT : on NE détruit PAS la démo tout de suite. Le widget Calendly est préparé À CÔTÉ,
  // invisible ; on ne bascule (retirer la démo, révéler le widget, masquer le badge « prochain
  // créneau » de démo) QUE lorsque Calendly a réellement injecté son iframe. Ainsi :
  //  - hors-ligne / réseau bloqué : la démo n'est JAMAIS touchée — elle reste VIVANTE (ses
  //    écouteurs, posés par pages/index.js au chargement, ne sont pas perdus) ;
  //  - le badge de démo est mis à jour par le vrai calcul (plus de date figée périmée).
  // (L'ancienne version vidait la démo immédiatement : restaurée après échec, elle était inerte.)
  var urg = document.querySelector('#booking .bk-urgency');

  var w = document.createElement('div');
  w.className = 'calendly-inline-widget';
  w.setAttribute('data-url', url);
  w.style.minWidth = '320px';
  w.style.height = '660px';
  w.style.display = 'none';          // préparé mais invisible tant que l'iframe n'a pas rendu
  host.appendChild(w);

  var settled = false;
  function restoreDemo() { if (settled) return; settled = true; if (w.parentNode) w.parentNode.removeChild(w); } // la démo n'a jamais bougé
  function confirmed() {
    settled = true;
    // Bascule : on retire les nœuds de la démo et on révèle le vrai calendrier.
    Array.prototype.slice.call(host.children).forEach(function (ch) { if (ch !== w) host.removeChild(ch); });
    w.style.display = '';
    if (urg) urg.style.display = 'none'; // la dispo de démo n'a pas de sens à côté du vrai Calendly
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
    s.onerror = restoreDemo; // script inaccessible -> on remet la démo
    document.head.appendChild(s);
  }

  // Calendly injecte un <iframe> dans le widget quand il s'initialise. On surveille : présent -> OK ;
  // absent après ~10 s (hors-ligne / bloqué) -> on restaure le calendrier de démonstration.
  var tries = 0;
  var iv = setInterval(function () {
    if (settled) { clearInterval(iv); return; }
    if (w.querySelector('iframe')) { confirmed(); clearInterval(iv); return; }
    if (++tries >= 40) { clearInterval(iv); restoreDemo(); }
  }, 250);
})();

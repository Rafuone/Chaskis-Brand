/* Chaskis, newsletter.js
   Section newsletter reprise du style de la page postuler :
   - fond carte Leaflet (Geneve, tuiles sombres), fige et purement decoratif ;
   - inscription best-effort vers l'admin (POST /api/crm), sans bloquer l'utilisateur.
   Partage entre l'accueil et la page commander. Degrade proprement si Leaflet absent. */
(function () {
  function initMaps() {
    if (typeof L === 'undefined') return; // pas de Leaflet -> on garde juste le fond sombre
    document.querySelectorAll('.nl-map').forEach(function (el) {
      if (el.dataset.nlInit) return;
      el.dataset.nlInit = '1';
      try {
        var map = L.map(el, {
          center: [46.2044, 6.1432], zoom: 14,
          zoomControl: false, dragging: false, scrollWheelZoom: false,
          doubleClickZoom: false, boxZoom: false, keyboard: false,
          attributionControl: false, tap: false,
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd', maxZoom: 19,
        }).addTo(map);
      } catch (e) {}
    });
  }

  function wireForms() {
    document.querySelectorAll('.nl-form').forEach(function (form) {
      if (form.dataset.nlWired) return;
      form.dataset.nlWired = '1';
      var input = form.querySelector('.nl-email');
      var ok = form.parentElement ? form.parentElement.querySelector('.nl-ok') : null;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (input && !input.checkValidity()) { input.reportValidity(); return; }
        var email = input ? input.value.trim() : '';
        var source = form.getAttribute('data-source') || 'newsletter';
        try {
          var payload = JSON.stringify({ email: email, newsletter: true, source: source, message: 'Inscription newsletter (' + source + ')' });
          if (navigator.sendBeacon) { navigator.sendBeacon('/api/crm', new Blob([payload], { type: 'application/json' })); }
          else { fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {}); }
        } catch (err) {}
        form.style.display = 'none';
        if (ok) ok.hidden = false;
      });
    });
  }

  function boot() { initMaps(); wireForms(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

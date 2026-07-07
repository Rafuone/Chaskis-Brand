/* Chaskis — postuler-map.js (ex-inline de postuler.html) */
(function(){
  var el = document.getElementById('rdlGmap');
  if (!el) return;
  var map = L.map(el, {
    center: [46.2044, 6.1432],
    zoom: 14,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
    tap: false,
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);
})();

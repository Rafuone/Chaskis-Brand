// ===== CHASKIS UTILS (window.CK) =====
// Petits utilitaires partages entre les pages et modules.
// A charger AVANT shared.js (et avant commander.js) sur chaque page.
(function () {
  const CK = window.CK || (window.CK = {});

  // Echappe le HTML pour une injection sure dans innerHTML / templates.
  CK.escapeHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  };

  // Debounce : n'appelle fn qu'apres `ms` ms sans nouvel appel.
  CK.debounce = function (fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  };
})();

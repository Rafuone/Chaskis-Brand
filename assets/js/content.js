// assets/js/content.js, lecteur de contenu publie (chantier "publish", cote public).
//
// Charge /site-content.json (le fichier ecrit par l'admin lors d'une publication) et
// fusionne son contenu par-dessus les valeurs par defaut de la page : textes i18n
// (window.T), pricing (window.CHASKIS_PRICING). Puis reapplique l'i18n.
//
// REGLE D'OR : strictement fail-silent. Si le fichier est absent, illisible, vide ou
// invalide, on ne fait RIEN et la page garde ses valeurs par defaut (jamais de page
// blanche, jamais d'erreur bloquante). C'est ce qui garantit que le site (et la demo,
// qui tourne sans backend) reste intact tant qu'aucun contenu n'est publie.
//
// Securite : les valeurs publiees transitent par le validateur serveur
// (api/_lib/content-schema.js) qui refuse toute balise HTML / dataURL au moment de
// publier. content.js ne fait donc qu'appliquer du texte deja assaini.
(function () {
  function currentLang() {
    try { return window._currentLang || localStorage.getItem('chaskisLang') || 'fr'; }
    catch (e) { return 'fr'; }
  }
  // Associe l'URL courante a une cle de page du contrat site-content.json. Gere les DEUX formes :
  // avec .html (index.html) ET les URLs canoniques propres du sitemap/rewrites (/commander,
  // /mobilite...). Sans ca, le contenu publie n'etait applique que sur les URLs en .html.
  function pageKey() {
    var path = (location.pathname || '/').toLowerCase();
    if (/^\/suivi(\/|$)/.test(path)) return 'suivi';
    var f = (path.split('/').pop() || '').replace(/\.html$/, '');
    var map = {
      '': 'accueil', 'index': 'accueil',
      'mobilite': 'mobilite', 'postuler': 'recrutement',
      'commander': 'commander', 'dashboard': 'dashboard', 'app': 'suivi'
    };
    return map[f] || 'accueil';
  }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function apply(data) {
    try {
      if (!isObj(data)) return;
      // Pricing : alimente le simulateur (meme mecanisme que l'editeur).
      if (isObj(data.pricing)) {
        window.CHASKIS_PRICING = data.pricing;
        try { if (typeof window._simUpdate === 'function') window._simUpdate(); } catch (e) {}
      }
      // Textes i18n de la page courante : fusion additive par-dessus window.T.
      var pg = isObj(data.pages) ? data.pages[pageKey()] : null;
      if (pg && isObj(pg.i18n)) {
        window.T = window.T || {};
        Object.keys(pg.i18n).forEach(function (lg) {
          if (isObj(pg.i18n[lg])) {
            window.T[lg] = Object.assign({}, window.T[lg] || {}, pg.i18n[lg]);
          }
        });
        if (typeof window.applyI18n === 'function') window.applyI18n(currentLang());
      }
      // Images publiees : remplace la source des <img> par l'URL du media (Blob). On matche par
      // le src d'ORIGINE (tel qu'ecrit dans le HTML, toujours present car publier ne reecrit pas
      // le HTML). Uniquement des URL https. JAMAIS dans l'editeur (iframe) : l'admin gere son
      // propre apercu ; on evite ainsi que l'editeur capture une URL Blob comme "src d'origine".
      var inIframe = false; try { inIframe = (window.top !== window.self); } catch (e) { inIframe = true; }
      if (!inIframe && pg && isObj(pg.images)) {
        try {
          var imgs = document.querySelectorAll('img');
          for (var i = 0; i < imgs.length; i++) {
            var s = imgs[i].getAttribute('src'); if (!s) continue;
            var url = pg.images[s];
            if (typeof url === 'string' && /^https:\/\//i.test(url)) {
              imgs[i].setAttribute('data-ck-orig-src', s);
              // Repli : si le media Blob est inaccessible/supprime, on revient a l'image d'origine
              // (une seule fois, pas de boucle) plutot que d'afficher une image cassee.
              imgs[i].onerror = function () { var o = this.getAttribute('data-ck-orig-src'); if (o && this.src.indexOf(o) < 0) { this.onerror = null; this.src = o; } };
              imgs[i].src = url;
            }
          }
        } catch (e) { /* fail-silent */ }
      }
    } catch (e) { /* fail-silent */ }
  }

  function load() {
    try {
      fetch('/site-content.json?ts=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (d) { if (d) apply(d); })
        .catch(function () { /* fail-silent : le site garde ses valeurs par defaut */ });
    } catch (e) { /* fail-silent */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();

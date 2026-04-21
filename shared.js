// ===== CHASKIS SHARED JS =====

// ===== FOOTER PARTAGÉ =====
(function() {
  const footer = document.querySelector('footer[data-shared]');
  if (!footer) return;
  footer.innerHTML = '<div class="ct"><div class="ft"><div class="fb"><a href="index.html" class="nav-logo"><img src="Chaskis-logo-ondark.svg" alt="Chaskis" height="20"></a><p data-i18n="foot.tag">Livraison, mobilit\u00e9 et infrastructure logistique pour les entreprises de Suisse romande.</p><div class="fb-soc"><a href="https://www.instagram.com/chaskisdelivery/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg></a><a href="https://www.linkedin.com/company/chaskis-sa/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a><a href="https://www.tiktok.com/@chaskisdelivery_" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg></a></div></div><div class="fc"><h4 data-i18n="foot.svc.h">Services</h4><a href="commander.html" data-i18n="foot.svc.1">Commander</a><a href="dashboard.html" data-i18n="foot.svc.2">Tableau de bord</a><a href="index.html#services" data-i18n="foot.svc.3">Nos secteurs</a><a href="index.html#booking" data-i18n="foot.svc.4">R\u00e9server un appel</a></div><div class="fc"><h4 data-i18n="foot.co.h">Entreprise</h4><a href="postuler.html" data-i18n="foot.co.1">Postuler</a><a href="index.html#faq">FAQ</a><a href="mailto:contact@chaskis.ch">contact@chaskis.ch</a></div><div class="fc"><h4 data-i18n="foot.leg.h">L\u00e9gal</h4><a href="#" data-i18n="foot.leg.1">Mentions l\u00e9gales</a><a href="#" data-i18n="foot.leg.2">Confidentialit\u00e9</a><a href="#" data-i18n="foot.leg.3">CGV</a></div></div><div class="f-btm"><span>\u00a9 2026 Chaskis SA \u00b7 Gen\u00e8ve</span><span class="f-credit">D\u00e9velopp\u00e9 par <a href="https://gamaproject.ch" target="_blank" rel="noopener noreferrer">Gamma-Project</a></span></div></div>';
})();

// ===== PWA INSTALL : capture globale =====
let _pwaPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  // Si un bouton d'install existe sur cette page, l'activer
  const btn = document.getElementById('pwa-install-btn');
  if (btn) { btn.dataset.ready = 'true'; btn.textContent = 'Installer'; }
});
window.addEventListener('appinstalled', () => {
  _pwaPrompt = null;
  const banner = document.getElementById('appBanner');
  if (banner) banner.remove();
});

// Nav scroll
const nav = document.getElementById('nav');
if (nav) window.addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });

// Mobile menu
const mt = document.getElementById('mt'), mm = document.getElementById('mm');
if (mt && mm) {
  mt.addEventListener('click', () => {
    const o = mm.classList.toggle('on');
    mt.classList.toggle('on');
    document.body.style.overflow = o ? 'hidden' : '';
  });
}
function cm() { if (mm) mm.classList.remove('on'); if (mt) mt.classList.remove('on'); document.body.style.overflow = ''; }

// ===== I18N : universal helpers + persistence =====
// Base dict for chrome (nav, footer) that every page shares.
window.T_BASE = window.T_BASE || {
  fr: {
    'nav.livraison': 'Livraison', 'nav.mobilite': 'Mobilité', 'nav.postuler': 'Postuler', 'nav.commander': 'Commander une course', 'nav.dashboard': 'Tableau de bord',
    'foot.tag': 'Livraison, mobilité et infrastructure logistique pour les entreprises de Suisse romande.',
    'foot.svc.h': 'Services', 'foot.svc.1': 'Commander', 'foot.svc.2': 'Tableau de bord', 'foot.svc.3': 'Nos secteurs', 'foot.svc.4': 'Réserver un appel',
    'foot.co.h': 'Entreprise', 'foot.co.1': 'Postuler',
    'foot.leg.h': 'Légal', 'foot.leg.1': 'Mentions légales', 'foot.leg.2': 'Confidentialité', 'foot.leg.3': 'CGV',
    'foot.credit': 'Développé par',
  },
  en: {
    'nav.livraison': 'Delivery', 'nav.mobilite': 'Mobility', 'nav.postuler': 'Join us', 'nav.commander': 'Order a ride', 'nav.dashboard': 'Dashboard',
    'foot.tag': 'Delivery, mobility and logistics infrastructure for French-speaking Swiss businesses.',
    'foot.svc.h': 'Services', 'foot.svc.1': 'Order', 'foot.svc.2': 'Dashboard', 'foot.svc.3': 'Our sectors', 'foot.svc.4': 'Schedule a call',
    'foot.co.h': 'Company', 'foot.co.1': 'Join us',
    'foot.leg.h': 'Legal', 'foot.leg.1': 'Legal notice', 'foot.leg.2': 'Privacy', 'foot.leg.3': 'T&C',
    'foot.credit': 'Developed by',
  }
};

// Merges T_BASE + page's window.T into one dict for current lang.
window.getDict = function(lang) {
  const base = (window.T_BASE && window.T_BASE[lang]) || {};
  const page = (window.T && window.T[lang]) || {};
  return Object.assign({}, base, page);
};

// Applies a dict to every [data-i18n*] element in the DOM.
window.applyI18n = function(lang) {
  const dict = window.getDict(lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = dict[el.dataset.i18n];
    if (v !== undefined) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const v = dict[el.dataset.i18nHtml];
    if (v !== undefined) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const v = dict[el.dataset.i18nPlaceholder];
    if (v !== undefined) el.placeholder = v;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const v = dict[el.dataset.i18nAria];
    if (v !== undefined) el.setAttribute('aria-label', v);
  });
  document.documentElement.lang = lang;
};

// Updates dropdown/mobile button UI state + flags.
window.__chaskisUpdateLangUI = function(lang) {
  const triggerFlag = document.getElementById('langFlag');
  const triggerCode = document.getElementById('langCode');
  if (triggerFlag) {
    const flagSrc = lang === 'en' ? 'flag-gb.svg' : 'flag-fr.svg';
    const flagAlt = lang === 'en' ? 'English' : 'Français';
    triggerFlag.innerHTML = '<img src="' + flagSrc + '" alt="' + flagAlt + '" width="18" height="13">';
  }
  if (triggerCode) triggerCode.textContent = lang.toUpperCase();
  document.querySelectorAll('.lang-drop-item').forEach(b => {
    const active = b.dataset.lang === lang;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.mob-lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
};

// Universal entry point: save lang, apply i18n, update UI, call page setLang if present.
window.__chaskisSetLang = function(lang) {
  try { localStorage.setItem('chaskisLang', lang); } catch(e){}
  window._currentLang = lang;
  window.applyI18n(lang);
  window.__chaskisUpdateLangUI(lang);
  // Let pages with their own setLang do page-specific rebuilds (sim, calendar, testi, etc.)
  if (typeof window.setLang === 'function' && window.setLang !== window.__chaskisSetLang) {
    try { window.setLang(lang); } catch(e){ console.warn('page setLang failed', e); }
  }
};

// Lang dropdown handler
(function() {
  const drop = document.getElementById('langDrop');
  const trigger = document.getElementById('langTrigger');
  const menu = document.getElementById('langMenu');
  if (!drop || !trigger || !menu) return;
  function open() { drop.dataset.open = ''; trigger.setAttribute('aria-expanded', 'true'); }
  function close() { delete drop.dataset.open; trigger.setAttribute('aria-expanded', 'false'); }
  trigger.addEventListener('click', e => { e.stopPropagation(); drop.hasAttribute('data-open') ? close() : open(); });
  menu.addEventListener('click', e => {
    const item = e.target.closest('.lang-drop-item');
    if (!item) return;
    window.__chaskisSetLang(item.dataset.lang);
    close();
  });
  document.addEventListener('click', e => { if (!drop.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

// Auto-apply stored language on page load. Runs AFTER page-level scripts that register window.setLang,
// via DOMContentLoaded (setLang definitions in inline <script> run before this).
(function() {
  function applyStored() {
    let stored = 'fr';
    try { stored = localStorage.getItem('chaskisLang') || 'fr'; } catch(e){}
    window.__chaskisSetLang(stored);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyStored);
  else applyStored();
})();

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = document.querySelector(a.getAttribute('href'));
  if (t) { e.preventDefault(); cm(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}));

// Scroll reveal with IntersectionObserver
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('v');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.rv,.rl,.rr,.rs,.stg,.rrot,.rblur,.rclip,.rcount').forEach(el => revealObs.observe(el));

// Animated counters
const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const decimal = el.dataset.decimal === 'true';
      const dur = 2000;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const val = target * eased;
        el.textContent = prefix + (decimal ? val.toFixed(1) : Math.round(val)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      counterObs.unobserve(el);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => counterObs.observe(el));

// FAQ accordion
document.querySelectorAll('.faq-q').forEach(q => {
  q.addEventListener('click', () => {
    const item = q.parentElement;
    const answer = item.querySelector('.faq-a');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.faq-a').style.maxHeight = '0';
    });
    if (!wasOpen) {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q.click(); }
  });
});

// Tilt effect on cards (desktop only)
if (window.matchMedia('(hover:hover)').matches) {
  document.querySelectorAll('.tilt-3d').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `translateY(-6px) perspective(800px) rotateX(${y * -5}deg) rotateY(${x * 5}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ===== SMART DOWNLOAD (OS-aware app store link) =====
// Détecte l'OS et met en avant le bon store. Fallback no-JS: les deux boutons restent visibles.
(function initSmartDownload() {
  const nodes = document.querySelectorAll('.smart-dl');
  if (!nodes.length) return;
  const ua = (navigator.userAgent || '').toLowerCase();
  const uaData = navigator.userAgentData;
  const platform = uaData && uaData.platform ? uaData.platform.toLowerCase() : '';
  // Apple family: iOS, iPadOS, macOS → App Store. Tout le reste (Android, Windows, Linux, ChromeOS) → Play Store.
  const isApple = /iphone|ipad|ipod|macintosh|mac os x/.test(ua) || /mac/.test(platform);
  nodes.forEach(root => {
    const appleUrl = root.dataset.sdlApple || '#';
    const googleUrl = root.dataset.sdlGoogle || '#';
    const primary = root.querySelector('.sdl-primary');
    const secondary = root.querySelector('.sdl-secondary');
    const secondaryLink = root.querySelector('.sdl-secondary-link');
    const apple = { store: 'App Store', url: appleUrl };
    const google = { store: 'Google Play', url: googleUrl };
    const main = isApple ? apple : google;
    const other = isApple ? google : apple;
    if (primary) {
      primary.href = main.url;
      primary.setAttribute('aria-label', "Télécharger l'app Chaskis sur " + main.store);
      const eyebrow = primary.querySelector('small');
      const label = primary.querySelector('strong');
      const svg = primary.querySelector('svg');
      if (eyebrow) eyebrow.textContent = isApple ? 'Télécharger sur' : 'Disponible sur';
      if (label) label.textContent = main.store;
      if (svg) svg.innerHTML = isApple
        ? '<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>'
        : '<path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.4l2.584 1.496a1 1 0 010 1.394l-2.585 1.496-2.528-2.528 2.53-2.858zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z"/>';
    }
    if (secondary) {
      secondary.href = other.url;
      secondary.setAttribute('aria-label', "Télécharger l'app Chaskis sur " + other.store);
    }
    if (secondaryLink) {
      secondaryLink.href = other.url;
      secondaryLink.innerHTML = "Disponible aussi sur <strong>" + other.store + "</strong>";
      secondaryLink.setAttribute('aria-label', "Télécharger sur " + other.store);
    }
    root.dataset.ready = 'true';
  });
})();

// Parallax on scroll for hero elements
function initParallax() {
  const els = document.querySelectorAll('[data-parallax]');
  if (!els.length) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    els.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      el.style.transform = `translateY(${y * speed}px)`;
    });
  }, { passive: true });
}
initParallax();

// ===== PAGE TRANSITION CURTAIN (partagé) =====
(function() {
  const c = document.getElementById('pageCurtain');
  if (!c) return;
  // À l'arrivée : on retire le rideau après le premier rendu
  setTimeout(() => c.classList.add('is-lifted'), 50);
  // Au départ : slide depuis la droite puis navigation
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank') return;
    const abs = link.href;
    if (abs.startsWith('http') && !abs.includes(location.hostname)) return;
    e.preventDefault();
    c.style.transition = 'none';
    c.style.transform = 'translateX(110%)';
    c.style.pointerEvents = 'all';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      c.style.transition = 'transform .42s cubic-bezier(.4,0,.2,1)';
      c.style.transform = 'translateX(0)';
      setTimeout(() => { window.location.href = abs; }, 390);
    }));
  });
})();

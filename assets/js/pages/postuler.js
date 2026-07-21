/* Chaskis, postuler.js (ex-inline de postuler.html) */
/* NAV OVER DARK */
(function(){
  const nav = document.getElementById('nav');
  const darkSections = document.querySelectorAll('.r-motion, .r-dl, .footer');
  if (!nav) return;
  function updateNav() {
    if (scrollY <= 40) { nav.classList.remove('over-dark'); return; }
    const navBottom = nav.getBoundingClientRect().bottom;
    const overDark = [...darkSections].some(s => {
      const r = s.getBoundingClientRect();
      return r.top < navBottom && r.bottom > navBottom;
    });
    nav.classList.toggle('over-dark', overDark);
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
})();

/* FLOAT CTA : apparaît quand le hero CTA sort du viewport */
(function(){
  const heroCta = document.getElementById('rHeroCta');
  const floatCta = document.getElementById('rFloatCta');
  if (!heroCta || !floatCta) return;
  new IntersectionObserver(([e]) => {
    floatCta.classList.toggle('visible', !e.isIntersecting);
  }).observe(heroCta);
})();

/* HERO TYPEWRITER : rotation coursier <-> chauffeur + crossfade photo + accent couleur */
(function(){
  const dict = {
    fr: ['coursier', 'chauffeur'],
    en: ['courier', 'driver']
  };
  const layers = document.querySelectorAll('.r-hero-img-layer');
  if (layers.length < 2) return;
  let idx = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function getRot(){ return document.querySelector('.r-hero-rotate'); }
  function applyColor(el, isDriver) {
    // Toggle on parent .sa so "chaque X" swaps color as a whole
    const sa = el.closest('.sa');
    if (sa) sa.classList.toggle('is-driver', isDriver);
  }
  function cycle() {
    const rot = getRot();
    if (!rot) return;
    const lang = (window._currentLang === 'en') ? 'en' : 'fr';
    const words = dict[lang];
    idx = (idx + 1) % words.length;
    const next = words[idx];
    const isDriver = (idx === 1);
    if (reduced) {
      rot.textContent = next;
      applyColor(rot, isDriver);
      layers.forEach((l, i) => l.classList.toggle('is-active', i === idx));
      return;
    }
    rot.classList.add('is-leaving');
    setTimeout(() => {
      const r2 = getRot();
      if (!r2) return;
      r2.textContent = next;
      applyColor(r2, isDriver);
      r2.classList.remove('is-leaving');
      r2.classList.add('is-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => r2.classList.remove('is-entering')));
    }, 300);
    setTimeout(() => {
      layers.forEach((l, i) => l.classList.toggle('is-active', i === idx));
    }, 500);
  }
  setInterval(cycle, 3400);
})();

/* HERO 3D TILT */
(function(){
  const wrap = document.querySelector('.r-hero-img-wrap');
  const inner = document.getElementById('heroImg');
  if (!wrap || !inner) return;
  if (!window.matchMedia('(hover:hover)').matches) return;
  wrap.addEventListener('mousemove', e => {
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    inner.style.transform = `rotateY(${x * 10}deg) rotateX(${y * -6}deg) scale(1.03)`;
  });
  wrap.addEventListener('mouseleave', () => { inner.style.transform = ''; });
})();

/* MOTION PANELS : load real bg images when available */
(function(){
  document.querySelectorAll('.r-motion-bg-img[data-real-src]').forEach(el => {
    const src = el.dataset.realSrc;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = 'url("' + src + '")';
    };
    img.src = src;
  });
})();

/* VOLET : click to expand */
(function(){
  const volet = document.getElementById('rVolet');
  if (!volet) return;
  const cards = volet.querySelectorAll('.r-volet-card');
  function activate(card) {
    cards.forEach(c => {
      const active = c === card;
      c.classList.toggle('is-active', active);
    });
  }
  cards.forEach(card => {
    card.addEventListener('click', function() {
      if (!this.classList.contains('is-active')) activate(this);
    });
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(this); }
    });
  });
})();

/* VOLET : handle missing portrait photos */
(function(){
  document.querySelectorAll('.r-volet-photo').forEach(wrap => {
    const img = wrap.querySelector('img');
    if (!img) return;
    function showPrompt() {
      img.style.display = 'none';
      const prompt = wrap.querySelector('.img-prompt');
      if (prompt) prompt.style.display = 'flex';
    }
    if (img.complete && img.naturalWidth === 0) { showPrompt(); return; }
    img.addEventListener('error', showPrompt);
  });
})();

/* COMPARATIF : révélation ligne par ligne au scroll */
(function(){
  const rows = document.querySelectorAll('.r-cmp-tr');
  if (!rows.length || !window.IntersectionObserver) {
    rows.forEach(r => r.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.3, rootMargin: '0px 0px -60px 0px' });
  rows.forEach((r, i) => {
    r.style.transitionDelay = `${i * 0.06}s`;
    io.observe(r);
  });
})();

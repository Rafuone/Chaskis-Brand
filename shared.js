// ===== CHASKIS SHARED JS =====

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

// Lang dropdown (works on all pages; defers to page-level setLang if available)
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
    const lang = item.dataset.lang;
    // Defer to page-level i18n if present, otherwise just update UI state
    if (typeof window.setLang === 'function') {
      window.setLang(lang);
    } else {
      try { localStorage.setItem('chaskisLang', lang); } catch(e){}
      const triggerFlag = document.getElementById('langFlag');
      if (triggerFlag) {
        const flagSrc = lang === 'en' ? 'flag-gb.svg' : 'flag-fr.svg';
        const flagAlt = lang === 'en' ? 'English' : 'Français';
        triggerFlag.innerHTML = '<img src="' + flagSrc + '" alt="' + flagAlt + '" width="18" height="13">';
      }
      document.querySelectorAll('.lang-drop-item').forEach(b => {
        const active = b.dataset.lang === lang;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('.mob-lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
      document.documentElement.lang = lang;
    }
    close();
  });
  document.addEventListener('click', e => { if (!drop.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
function cm() {
  if (mm) mm.classList.remove('on');
  if (mt) mt.classList.remove('on');
  document.body.style.overflow = '';
}

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

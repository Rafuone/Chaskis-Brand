/* Chaskis — mobilite.js (ex-inline de mobilite.html) */
// Échappement HTML local (l'autocomplétion insère la réponse de l'API geo.admin en innerHTML).
function mEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// ===== FORM : type toggle + 3-step stepper =====
(function() {
  const types = document.querySelectorAll('.mob-form-type');
  const hidden = document.getElementById('mobRequestType');
  const label = document.getElementById('mobRequestTypeLabel');
  const steps = document.querySelectorAll('.mob-form-step');
  const pSteps = document.querySelectorAll('.mob-form-progress-step');

  types.forEach(t => {
    t.addEventListener('click', () => {
      types.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      hidden.value = t.dataset.type;
      if (label) label.textContent = t.dataset.label || t.querySelector('strong').textContent;
    });
  });

  function goto(n) {
    steps.forEach(s => s.classList.toggle('is-active', Number(s.dataset.step) === n));
    pSteps.forEach(p => {
      const i = Number(p.dataset.pstep);
      p.classList.remove('is-active','is-done');
      if (i < n) p.classList.add('is-done');
      else if (i === n) p.classList.add('is-active');
    });
    const card = document.querySelector('.mob-form-card');
    if (card) card.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => goto(Number(btn.dataset.goto)));
  });
})();

// ===== PRESTIGE reveal : IO fallback (mobile / si GSAP indisponible) =====
(function() {
  const section = document.querySelector('.mob-prestige');
  if (!section) return;
  // Desktop : le pin GSAP (window.load) prend la main — on ne touche pas à scene-pinned
  if (window.matchMedia('(min-width:900px)').matches) return;
  section.classList.add('scene-ready');
  if (!('IntersectionObserver' in window)) {
    section.classList.add('scene-active');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !section.classList.contains('scene-pinned')) {
        section.classList.add('scene-active');
        io.unobserve(section);
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });
  io.observe(section);
  setTimeout(() => { if (!section.classList.contains('scene-pinned')) section.classList.add('scene-active'); }, 3000);
})();

// ===== TILT EFFECT : hero visual + diff cards =====
(function() {
  if (!window.matchMedia('(hover:hover)').matches) return;

  // Hero visual tilt
  const heroVis = document.getElementById('mobHeroVis');
  if (heroVis) {
    // The fadeUp animation with "forwards" overrides inline transform. Drop it after it ends
    // so the tilt can take effect. Preserve the final opacity.
    const clearAnim = () => { heroVis.style.animation = 'none'; heroVis.style.opacity = '1'; };
    heroVis.addEventListener('animationend', clearAnim, { once: true });
    // Safety: if the animation fired before the listener or was interrupted, clear after 1.5s.
    setTimeout(clearAnim, 1500);
    heroVis.addEventListener('mousemove', e => {
      const r = heroVis.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      heroVis.style.transform = `rotateY(${x * 10}deg) rotateX(${y * -6}deg) scale(1.03)`;
      heroVis.style.boxShadow = `${x * -20}px ${y * -10}px 60px rgba(0,0,0,.6), 0 40px 80px rgba(0,0,0,.5)`;
    });
    heroVis.addEventListener('mouseleave', () => {
      heroVis.style.transform = '';
      heroVis.style.boxShadow = '';
    });
  }

  // Diff cards tilt
  document.querySelectorAll('.mob-diff-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `translateY(-6px) rotateY(${x * 7}deg) rotateX(${y * -5}deg)`;
      card.style.setProperty('--mx', `${(e.clientX - r.left)}px`);
      card.style.setProperty('--my-p', `${(e.clientY - r.top)}px`);
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();

// PAGE TRANSITION : géré par assets/js/shared.js

// ===== ORBS parallax (background) =====
(function() {
  const orbs = document.querySelectorAll('.mob-orbs-o');
  if (!orbs.length) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      orbs.forEach(o => {
        const s = parseFloat(o.dataset.orbSpeed || '.2');
        o.style.transform = `translate3d(0, ${-y * s}px, 0)`;
      });
      ticking = false;
    });
  }, { passive: true });
})();

function submitMobRequest(e) {
  e.preventDefault();
  const form = e.target;
  const email = (form.querySelector('#mobEmail')?.value || '').trim() || 'votre adresse';
  const ref = 'CHK-' + Math.random().toString(36).substr(2,4).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();
  const refEl = document.getElementById('mobOrderRef');
  const emailEl = document.getElementById('mobSuccessEmail');
  if (refEl) refEl.textContent = ref;
  if (emailEl) emailEl.textContent = email;
  form.querySelectorAll('.mob-form-step, .mob-form-progress').forEach(el => { el.style.display = 'none'; });
  const suc = document.getElementById('mobFormSuccess');
  if (suc) suc.classList.add('is-visible');
}

// Reset form after success
(function() {
  const resetBtn = document.getElementById('mobFormReset');
  if (!resetBtn) return;
  resetBtn.addEventListener('click', () => {
    const form = document.getElementById('mobRequestForm');
    if (!form) return;
    form.reset();
    document.getElementById('mobDateTime').value = '';
    form.querySelectorAll('.mob-form-step').forEach((s,i) => { s.classList.toggle('is-active', i===0); s.style.display=''; });
    form.querySelectorAll('.mob-form-progress-step').forEach((s,i) => { s.classList.toggle('is-active', i===0); s.classList.remove('is-done'); });
    form.querySelectorAll('.mob-form-type').forEach((b,i) => b.classList.toggle('active', i===0));
    document.getElementById('mobFormSuccess').classList.remove('is-visible');
  });
})();

// ===== ADDRESS AUTOCOMPLETE (swisstopo) =====
(function() {
  const PIN_SVG = '<svg class="mob-ac-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  // Parse "label" HTML from swisstopo and split into street + (zip + city)
  // Swisstopo label examples: "1 Rue Eugène-DUPONT <b>1207</b> <b>Genève</b>" — we strip tags then regex
  function splitAddress(raw) {
    const text = raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const m = text.match(/^(.*?)\s(\d{4}\s+.+)$/);
    if (m) return { street: m[1].trim(), city: m[2].trim() };
    return { street: text, city: '' };
  }

  function initAC(inputId) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const dd = document.createElement('div');
    dd.className = 'mob-ac-dropdown';
    dd.hidden = true;
    inp.parentElement.appendChild(dd);
    let timer;
    let items = [];
    let active = -1;

    function renderItems(results) {
      items = results;
      active = -1;
      if (!results.length) { dd.innerHTML = '<div class="mob-ac-empty">Aucun résultat</div>'; dd.hidden = false; return; }
      dd.innerHTML = results.map((r, i) => {
        const parts = splitAddress(r.attrs.label || r.attrs.detail || '');
        const full = mEsc(parts.street + (parts.city ? ', ' + parts.city : ''));
        return '<div class="mob-ac-item" data-i="' + i + '" data-v="' + full + '">' +
          PIN_SVG +
          '<div class="mob-ac-text">' +
            '<span class="mob-ac-street">' + mEsc(parts.street) + '</span>' +
            (parts.city ? '<span class="mob-ac-city">' + mEsc(parts.city) + '</span>' : '') +
          '</div>' +
        '</div>';
      }).join('');
      dd.hidden = false;
      dd.querySelectorAll('.mob-ac-item').forEach(item => {
        item.addEventListener('mousedown', ev => { ev.preventDefault(); inp.value = item.dataset.v; inp.dispatchEvent(new Event('input', { bubbles:true })); dd.hidden = true; });
      });
    }

    inp.addEventListener('input', function() {
      clearTimeout(timer);
      const q = this.value.trim();
      if (q.length < 3) { dd.hidden = true; return; }
      timer = setTimeout(() => {
        fetch('https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=' + encodeURIComponent(q) + '&type=locations&origins=address&lang=fr&limit=7&sr=4326')
          .then(r => r.json()).then(data => {
            const res = (data.results || []).slice(0,7);
            renderItems(res);
          }).catch(() => { dd.hidden = true; });
      }, 250);
    });

    inp.addEventListener('keydown', e => {
      if (dd.hidden) return;
      const nodes = dd.querySelectorAll('.mob-ac-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, nodes.length - 1); nodes.forEach((n,i) => n.classList.toggle('is-active', i === active)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); nodes.forEach((n,i) => n.classList.toggle('is-active', i === active)); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); const chosen = nodes[active]; if (chosen) { inp.value = chosen.dataset.v; inp.dispatchEvent(new Event('input', { bubbles:true })); dd.hidden = true; } }
      else if (e.key === 'Escape') { dd.hidden = true; }
    });

    inp.addEventListener('blur', () => setTimeout(() => { dd.hidden = true; }, 160));
  }
  initAC('mobPickup');
  initAC('mobDropoff');
})();

// ===== REQUIRED-FIELDS GATE (disable submit until all required are filled) =====
(function() {
  const form = document.getElementById('mobRequestForm');
  const btn = document.getElementById('mobFormSubmitBtn');
  if (!form || !btn) return;
  function check() {
    const reqs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let ok = true;
    reqs.forEach(el => {
      const v = (el.value || '').trim();
      if (!v) { ok = false; return; }
      if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ok = false;
    });
    btn.disabled = !ok;
  }
  form.addEventListener('input', check);
  form.addEventListener('change', check);
  // Re-check when step 3 becomes visible (hidden inputs may have been filled by date picker)
  const obs = new MutationObserver(check);
  const step3 = form.querySelector('[data-step="3"]');
  if (step3) obs.observe(step3, { attributes: true, attributeFilter: ['class'] });
  check();
})();

// ===== CUSTOM DATETIME PICKER =====
(function() {
  const MO = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const MOS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const DOW = ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'];
  const disp = document.getElementById('mobDateTime');
  const panel = document.getElementById('mobDateTimePanel');
  const grid = document.getElementById('mobDpGrid');
  const title = document.getElementById('mobDpTitle');
  const hEl = document.getElementById('mobDpH');
  const mEl = document.getElementById('mobDpM');
  if (!disp || !panel) return;
  let selDate = null, h = 9, m = 0;
  const now = new Date();
  let cy = now.getFullYear(), cm = now.getMonth();

  function render() {
    title.textContent = MO[cm] + ' ' + cy;
    const first = new Date(cy, cm, 1);
    let dow = first.getDay(); dow = dow === 0 ? 6 : dow - 1;
    const days = new Date(cy, cm + 1, 0).getDate();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let html = '';
    for (let i = 0; i < dow; i++) html += '<div></div>';
    for (let d = 1; d <= days; d++) {
      const dt = new Date(cy, cm, d);
      const past = dt < today;
      const sel = selDate && selDate.getDate()===d && selDate.getMonth()===cm && selDate.getFullYear()===cy;
      const tod = dt.getTime()===today.getTime();
      html += '<div class="mob-dp-day' + (past?' is-past':'') + (sel?' is-sel':'') + (tod&&!sel?' is-today':'') + '" data-d="' + d + '">' + d + '</div>';
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.mob-dp-day:not(.is-past)').forEach(el => {
      el.addEventListener('click', () => {
        selDate = new Date(cy, cm, +el.dataset.d);
        render(); updateDisp();
      });
    });
  }

  function updateDisp() {
    if (!selDate) return;
    const hh = String(h).padStart(2,'0'), mm = String(m).padStart(2,'0');
    disp.value = DOW[selDate.getDay()] + ' ' + selDate.getDate() + ' ' + MOS[selDate.getMonth()] + ' ' + selDate.getFullYear() + ' · ' + hh + ':' + mm;
    document.getElementById('mobDate').value = selDate.toISOString().split('T')[0];
    document.getElementById('mobTime').value = hh + ':' + mm;
    hEl.textContent = hh; mEl.textContent = mm;
  }

  disp.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) render(); });
  document.addEventListener('click', e => { if (!disp.contains(e.target) && !panel.contains(e.target)) panel.hidden = true; });
  document.getElementById('mobDpPrev').addEventListener('click', () => { cm--; if(cm<0){cm=11;cy--;} render(); });
  document.getElementById('mobDpNext').addEventListener('click', () => { cm++; if(cm>11){cm=0;cy++;} render(); });
  document.getElementById('mobDpHDec').addEventListener('click', () => { h=(h-1+24)%24; updateDisp(); });
  document.getElementById('mobDpHInc').addEventListener('click', () => { h=(h+1)%24; updateDisp(); });
  document.getElementById('mobDpMDec').addEventListener('click', () => { m=(m-15+60)%60; updateDisp(); });
  document.getElementById('mobDpMInc').addEventListener('click', () => { m=(m+15)%60; updateDisp(); });
  document.getElementById('mobDpConfirm').addEventListener('click', () => { if(selDate) panel.hidden = true; });
  render();
})();

// ===== FAQ ACCORDION =====
document.querySelectorAll('.mob-faq-q').forEach((q, qi) => {
  // a11y : état ouvert/fermé annoncé aux lecteurs d'écran
  if (!q.hasAttribute('aria-expanded')) q.setAttribute('aria-expanded', q.parentElement.classList.contains('open') ? 'true' : 'false');
  // a11y : relier la question à son panneau réponse (aria-controls) — id généré si absent
  const ans = q.parentElement.querySelector('.mob-faq-a');
  if (ans) { if (!ans.id) ans.id = 'mob-faq-a-' + (qi + 1); q.setAttribute('aria-controls', ans.id); }
  q.addEventListener('click', () => {
    const item = q.parentElement;
    const answer = item.querySelector('.mob-faq-a');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.mob-faq-item.open').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.mob-faq-a').style.maxHeight = '0';
      const t = i.querySelector('.mob-faq-q'); if (t) t.setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
      q.setAttribute('aria-expanded', 'true');
    }
  });
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q.click(); }
  });
});

// ===== HERO H1 rotator (time-based) =====
(function() {
  let i = 0;
  // A11y : n'exposer que le mot actif au lecteur d'écran (sinon le H1 énonce toute la
  // liste de mots à la suite). État initial + mise à jour à chaque rotation.
  (function initRotA11y() {
    const rot = document.getElementById('mobHeroRot');
    if (!rot) return;
    rot.querySelectorAll('.hero-rot-word').forEach(w =>
      w.setAttribute('aria-hidden', w.classList.contains('is-active') ? 'false' : 'true'));
  })();
  setInterval(() => {
    const rot = document.getElementById('mobHeroRot');
    if (!rot) return;
    const words = rot.querySelectorAll('.hero-rot-word');
    if (words.length < 2) return;
    const current = words[i % words.length];
    i = (i + 1) % words.length;
    const next = words[i];
    current.classList.remove('is-active');
    current.classList.add('is-leaving');
    current.setAttribute('aria-hidden', 'true');
    next.classList.remove('is-leaving');
    next.classList.add('is-active');
    next.setAttribute('aria-hidden', 'false');
    setTimeout(() => current.classList.remove('is-leaving'), 900);
  }, 2800);
})();

// ===== SIGNATURE rotator FALLBACK (time-based, only if pin not active) =====
window.__mobSigFallback = function() {
  const rotator = document.getElementById('mobSignatureRotator');
  const bg = document.getElementById('mobSignatureBg');
  if (!rotator || rotator.dataset.driven === 'scroll') return;
  const words = rotator.querySelectorAll('.sig-word');
  const imgs = bg ? bg.querySelectorAll('.mob-signature-bg-img') : [];
  if (words.length < 2) return;
  // A11y : n'exposer que le mot actif de la signature au lecteur d'écran (comme le rotateur H1)
  words.forEach(w => w.setAttribute('aria-hidden', w.classList.contains('is-active') ? 'false' : 'true'));
  let i = 0;
  rotator.dataset.driven = 'timer';
  setInterval(() => {
    if (rotator.dataset.driven === 'scroll') return;
    const current = words[i];
    i = (i + 1) % words.length;
    const next = words[i];
    current.classList.remove('is-active');
    current.classList.add('is-leaving');
    current.setAttribute('aria-hidden', 'true');
    next.classList.remove('is-leaving');
    next.classList.add('is-active');
    next.setAttribute('aria-hidden', 'false');
    if (imgs.length) imgs.forEach(img => img.classList.toggle('is-active', img.dataset.word === next.dataset.word));
    setTimeout(() => current.classList.remove('is-leaving'), 900);
  }, 2600);
};
// Start fallback; if pin takes over later, it flips data-driven to 'scroll'
setTimeout(() => window.__mobSigFallback(), 200);

// ===== REVEAL ON SCROLL (progressive enhancement) =====
// Content stays fully visible by default. Only if IntersectionObserver is available
// do we opt-in to the reveal animation by adding js-reveal-ready on body.
(function() {
  if (!('IntersectionObserver' in window)) return;
  // Check if we're in a top-level document (not throttled iframe) by testing scroll reactivity
  let ioFired = false;
  const io = new IntersectionObserver((entries) => {
    ioFired = true;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  // Opt-in : only hide elements if we're confident IO will fire
  document.body.classList.add('js-reveal-ready');
  document.querySelectorAll('.rev').forEach(el => {
    // Already fully above the viewport (scrolled past) → reveal immediately.
    // bottom <= 0 is strict: never reveals below-fold elements early.
    // Handles browser scroll restoration landing mid-page.
    if (el.getBoundingClientRect().bottom <= 0) {
      el.classList.add('in');
    } else {
      io.observe(el);
    }
  });
  // Safety net : after 2s, if IO never fired at all, reveal everything
  setTimeout(() => {
    if (!ioFired) {
      document.body.classList.remove('js-reveal-ready');
    }
  }, 2000);
  // Also reveal everything after 4s unconditionally as ultimate fallback
  setTimeout(() => {
    document.querySelectorAll('.rev:not(.in)').forEach(el => el.classList.add('in'));
  }, 4000);
})();

// ===== COUNTER ANIMATION (pure JS, no GSAP dep) =====
(function() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.mob-proof-stat strong').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      el.textContent = target.toLocaleString('fr-CH') + suffix;
    });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      if (isNaN(target)) { io.unobserve(el); return; }
      const suffix = el.dataset.suffix || '';
      const dur = 2000;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString('fr-CH') + suffix;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.mob-proof-stat strong').forEach(el => io.observe(el));
})();

// ===== HOW-IT-WORKS STEPS : IO reveal mobile uniquement (desktop = pin GSAP ci-dessous) =====
(function() {
  const container = document.getElementById('mobHowSteps');
  if (!container) return;
  // Sur desktop ≥900px, le pin GSAP prend le relais — on ne touche à rien ici
  if (window.matchMedia('(min-width:900px)').matches) return;
  const steps = Array.from(container.querySelectorAll('.mob-how-step'));
  if (!steps.length) return;
  if (!('IntersectionObserver' in window)) {
    steps.forEach(s => s.classList.add('is-active'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    steps.forEach((step, i) => setTimeout(() => step.classList.add('is-active'), i * 180));
    io.disconnect();
  }, { threshold: 0.25 });
  io.observe(container);
})();

// ===== GSAP + LENIS : scroll-driven transitions only, no hidden states =====
// IMPORTANT: elements MUST stay visible by default. Only animate enhancements on top.
window.addEventListener('load', () => {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // Scroll natif (Lenis retire) : ScrollTrigger fonctionne nativement sur tous navigateurs.
  // Les scrubs GSAP (0.6 / 1 / 1.4) assurent le rendu lisse sur parallax et pins.

  // ===== HERO : subtle parallax on scroll (no opacity fade — avoids grayed-out state on mid-page load) =====
  gsap.to('.mob-hero-content', {
    y: -60, ease: 'none',
    scrollTrigger: { trigger: '.mob-hero', start: 'top top', end: 'bottom 30%', scrub: .8 }
  });

  // ===== PILLARS : parallax background images (scrub continu) =====
  gsap.utils.toArray('.mob-pillar-bg').forEach(bg => {
    const isPillar2 = !!bg.closest('.mob-pillar-2');
    const fromY = isPillar2 ? -100 : 0;
    const toY   = isPillar2 ? -180 : -80;
    gsap.fromTo(bg, { y: fromY }, {
      y: toY, ease: 'none',
      scrollTrigger: { trigger: bg, start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  });
  // Slight tilt of each pillar as it enters/exits
  gsap.utils.toArray('.mob-pillar').forEach((pillar, i) => {
    gsap.fromTo(pillar,
      { y: 60 },
      { y: -60, ease: 'none',
        scrollTrigger: { trigger: pillar, start: 'top bottom', end: 'bottom top', scrub: 1.4 }
      }
    );
  });

  // ===== DIFF CARDS : no GSAP transform (cards use .rev IO reveal, no extra offset needed) =====

  // ===== PRESTIGE : pin GSAP désactivé — le fallback IO (scene-ready/scene-active) prend le relais =====
  // Le pin ScrollTrigger causait des chevauchements visuels avec la section précédente
  // selon l'état du layout au moment de l'init. La révélation CSS+IO est plus fiable.

  // ===== HOW IT WORKS : mobile = IO fallback (fait plus haut), desktop = pin créé APRÈS Prestige =====
  const howFill = document.getElementById('mobHowFill');
  if (howFill && !window.matchMedia('(min-width:900px)').matches) {
    // Mobile : la track se remplit au scroll sans pin
    gsap.fromTo(howFill, { scaleX: 0 }, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '.mob-how-steps', start: 'top 80%', end: 'bottom 55%', scrub: 1 }
    });
  }

  // ===== SECTION HEADERS : subtle translate-y on scroll (breathing effect) =====
  // On exclut les headers des sections pinnées (Prestige, How) pour éviter les sauts au release
  gsap.utils.toArray('.mob-pillars-header').forEach(header => {
    if (header.closest('.mob-prestige, .mob-how')) return;
    gsap.fromTo(header,
      { y: 40 },
      { y: -40, ease: 'none',
        scrollTrigger: { trigger: header, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
      }
    );
  });

  // ===== PRESTIGE : scrollytelling pin (desktop ≥900px uniquement) =====
  const prestige = document.querySelector('.mob-prestige');
  const presRotator = document.getElementById('mobSignatureRotator');
  if (prestige && presRotator && window.matchMedia('(min-width:900px)').matches) {
    const presWords = Array.from(presRotator.querySelectorAll('.sig-word'));
    const presBgEl  = document.getElementById('mobSignatureBg');
    const presImgs  = presBgEl ? Array.from(presBgEl.querySelectorAll('.mob-signature-bg-img')) : [];

    // Bascule en mode pin (désactive le fallback IO)
    prestige.classList.remove('scene-ready', 'scene-active');
    prestige.classList.add('scene-pinned');
    presRotator.dataset.driven = 'scroll';
    // A11y : n'exposer que le mot actif de la signature au lecteur d'écran
    presWords.forEach(w => w.setAttribute('aria-hidden', w.classList.contains('is-active') ? 'false' : 'true'));

    const revItems = [
      prestige.querySelector('.mob-prestige-badge'),
      prestige.querySelector('.mob-prestige-text h2'),
      prestige.querySelector('.mob-prestige-lead'),
      prestige.querySelector('.mob-prestige-list li:nth-child(1)'),
      prestige.querySelector('.mob-prestige-list li:nth-child(2)'),
      prestige.querySelector('.mob-prestige-list li:nth-child(3)'),
      prestige.querySelector('.mob-prestige-text .mob-hero-btn-primary'),
    ].filter(Boolean);

    // Force l'état caché (au cas où l'IO aurait déjà tiré)
    gsap.set(revItems, { opacity: 0, y: 28 });

    let sigIdx = 0;
    const swapSig = (idx) => {
      if (idx === sigIdx || !presWords[idx]) return;
      const prev = presWords[sigIdx];
      const next = presWords[idx];
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      prev.setAttribute('aria-hidden', 'true');
      next.classList.remove('is-leaving');
      next.classList.add('is-active');
      next.setAttribute('aria-hidden', 'false');
      presImgs.forEach(img => img.classList.toggle('is-active', img.dataset.word === next.dataset.word));
      setTimeout(() => prev.classList.remove('is-leaving'), 900);
      sigIdx = idx;
    };

    const revealFlags = new Array(revItems.length).fill(false);
    ScrollTrigger.create({
      trigger: prestige,
      start: 'top top',
      end: `+=${revItems.length * 160 + 80}`,
      pin: true,
      pinSpacing: true,
      pinType: 'fixed',
      anticipatePin: 1,
      invalidateOnRefresh: true,
      fastScrollEnd: true,
      scrub: 0.6,
      onUpdate(self) {
        const idx = Math.min(Math.floor(self.progress * presWords.length), presWords.length - 1);
        swapSig(idx);
        revItems.forEach((item, i) => {
          if (revealFlags[i]) return;
          const threshold = (i + 0.5) / revItems.length;
          if (self.progress >= threshold) {
            revealFlags[i] = true;
            gsap.to(item, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', overwrite: 'auto' });
          }
        });
      }
    });
  }

  // ===== HOW IT WORKS : pin créé APRÈS Prestige + toggle (reverse au scroll-up) =====
  const howSection = document.querySelector('.mob-how');
  const howStepsEl = document.getElementById('mobHowSteps');
  const howFillEl = document.getElementById('mobHowFill');
  if (howSection && howStepsEl && window.matchMedia('(min-width:900px)').matches) {
    const howSteps = Array.from(howStepsEl.querySelectorAll('.mob-how-step'));
    howSection.classList.add('is-pinned');
    if (howFillEl) gsap.set(howFillEl, { scaleX: 0 });
    ScrollTrigger.create({
      trigger: howSection,
      start: 'top top',
      end: `+=${howSteps.length * 160 + 120}`,
      pin: true,
      pinSpacing: true,
      pinType: 'fixed',
      anticipatePin: 1,
      invalidateOnRefresh: true,
      fastScrollEnd: true,
      scrub: 0.6,
      onUpdate(self) {
        if (howFillEl) gsap.set(howFillEl, { scaleX: self.progress });
        // Toggle : les étapes s'allument/éteignent en fonction du scroll (reverse propre)
        howSteps.forEach((step, i) => {
          const threshold = (i + 0.5) / howSteps.length;
          step.classList.toggle('is-active', self.progress >= threshold);
        });
      }
    });
  }

  // ===== Refresh global : après tous les pins + fonts + resize debounced =====
  requestAnimationFrame(() => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  let rsz;
  window.addEventListener('resize', () => {
    clearTimeout(rsz);
    rsz = setTimeout(() => ScrollTrigger.refresh(), 120);
  }, { passive: true });

  // ===== MOUSE PARALLAX on hero (desktop only) =====
  const heroEl = document.getElementById('mobHero');
  if (heroEl && window.matchMedia('(pointer: fine)').matches) {
    heroEl.addEventListener('mousemove', e => {
      const rect = heroEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - .5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - .5) * 2;
      gsap.to('.mob-hero h1', { x: x * 10, y: y * 6, duration: 1.2, ease: 'power2.out' });
      gsap.to('.mob-hero-sub', { x: x * 5, y: y * 3, duration: 1.2, ease: 'power2.out' });
    });
  }
});

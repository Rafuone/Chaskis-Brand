/* Chaskis — index.js (ex-inline de index.html) */
// ===== BOOKING CALENDAR (3 steps, dynamic) =====
(function() {
  const bkCal = document.getElementById('bkCal');
  const bkSl = document.getElementById('bkSl');
  const bkSTitle = document.getElementById('bkSTitle');
  const bkMonth = document.getElementById('bkMonth');
  const bkPrev = document.getElementById('bkPrev');
  const bkNext = document.getElementById('bkNext');
  const bkNextSlot = document.getElementById('bkNextSlot');
  const bkN1 = document.getElementById('bkN1');
  const bkN2 = document.getElementById('bkN2');
  const bkB2 = document.getElementById('bkB2');
  const bkS1 = document.getElementById('bkS1');
  const bkS2 = document.getElementById('bkS2');
  const bkS3 = document.getElementById('bkS3');
  const bkProg = document.querySelector('.bk-prog');
  const progSpans = bkProg ? bkProg.querySelectorAll('span') : [];

  if (!bkCal || !bkSl) return;

  const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let calLang = 'fr';
  function MONTHS(){ return calLang === 'en' ? MONTHS_EN : MONTHS_FR; }
  function DAYS(){ return calLang === 'en' ? DAYS_EN : DAYS_FR; }
  const ALL_SLOTS = ['09:00','10:00','11:00','14:00','15:30','16:30'];

  // Deterministic pseudo-random from YYYYMMDD seed (stable across reloads)
  function rand(seed) {
    let x = seed;
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  }
  function dayKey(y,m,d){ return y*10000 + (m+1)*100 + d; }

  // For a given date, return array of available slots (subset of ALL_SLOTS)
  function slotsFor(y,m,d){
    const weekday = new Date(y,m,d).getDay(); // 0=Sun..6=Sat
    if (weekday === 0 || weekday === 6) return []; // weekends closed
    const r = rand(dayKey(y,m,d));
    // Distribution: 15% complet, 25% 1 slot, 30% 2-3 slots, 30% 4-5 slots
    if (r < 0.15) return [];
    if (r < 0.40) { // 1 slot
      const i = Math.floor(rand(dayKey(y,m,d)+7) * ALL_SLOTS.length);
      return [ALL_SLOTS[i]];
    }
    if (r < 0.70) { // 2-3 slots
      const count = 2 + Math.floor(rand(dayKey(y,m,d)+13) * 2);
      return pickSlots(y,m,d,count);
    }
    // 4-5 slots
    const count = 4 + Math.floor(rand(dayKey(y,m,d)+19) * 2);
    return pickSlots(y,m,d,count);
  }
  function pickSlots(y,m,d,count){
    const pool = ALL_SLOTS.slice();
    const out = [];
    let seed = dayKey(y,m,d);
    for (let i=0; i<count && pool.length; i++){
      seed += 23;
      const idx = Math.floor(rand(seed) * pool.length);
      out.push(pool.splice(idx,1)[0]);
    }
    return out.sort();
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  let viewY = today.getFullYear();
  let viewM = today.getMonth();

  let selectedY = null, selectedMo = null, selectedD = null;
  let selectedTime = null;

  function setStep(n) {
    [bkS1, bkS2, bkS3].forEach(s => s.classList.remove('active'));
    [bkS1, bkS2, bkS3][n - 1].classList.add('active');
    progSpans.forEach((s, i) => s.classList.toggle('done', i < n));
  }

  function renderSlots(y,m,d){
    const slots = slotsFor(y,m,d);
    bkSl.innerHTML = '';
    ALL_SLOTS.forEach(t => {
      const el = document.createElement('div');
      el.className = 'bk-sl';
      el.dataset.t = t;
      el.textContent = t;
      if (slots.indexOf(t) === -1) el.classList.add('taken');
      else el.addEventListener('click', () => {
        bkSl.querySelectorAll('.bk-sl.pk').forEach(s => s.classList.remove('pk'));
        el.classList.add('pk');
        selectedTime = t;
        bkN1.disabled = false;
      });
      bkSl.appendChild(el);
    });
    const n = slots.length;
    const isEn = calLang === 'en';
    if (n === 0) bkSTitle.textContent = isEn ? 'Fully booked today' : 'Complet ce jour';
    else if (n === 1) bkSTitle.textContent = isEn ? 'Last slot remaining' : 'Plus qu\'un créneau';
    else if (n <= 3) bkSTitle.textContent = isEn ? 'A few slots left' : 'Quelques créneaux restants';
    else bkSTitle.textContent = isEn ? 'Available slots' : 'Créneaux disponibles';
  }

  function selectDate(dayEl){
    bkCal.querySelectorAll('.bk-d.pk').forEach(d => d.classList.remove('pk'));
    dayEl.classList.add('pk');
    selectedY = parseInt(dayEl.dataset.y,10);
    selectedMo = parseInt(dayEl.dataset.m,10);
    selectedD = parseInt(dayEl.dataset.d,10);
    bkSl.classList.add('active');
    bkSTitle.classList.add('active');
    selectedTime = null;
    bkN1.disabled = true;
    renderSlots(selectedY, selectedMo, selectedD);
  }

  function renderMonth(){
    bkMonth.textContent = MONTHS()[viewM].charAt(0).toUpperCase()+MONTHS()[viewM].slice(1)+' '+viewY;
    // Clear (keep first 7 header cells)
    while (bkCal.children.length > 7) bkCal.removeChild(bkCal.lastChild);
    // Monday-first grid
    const first = new Date(viewY, viewM, 1);
    let startOffset = first.getDay() - 1; if (startOffset < 0) startOffset = 6; // Mon=0..Sun=6
    for (let i=0; i<startOffset; i++){
      const d = document.createElement('div');
      d.className = 'bk-d';
      bkCal.appendChild(d);
    }
    const daysInMonth = new Date(viewY, viewM+1, 0).getDate();
    for (let d=1; d<=daysInMonth; d++){
      const el = document.createElement('div');
      el.className = 'bk-d';
      el.textContent = d;
      const dt = new Date(viewY, viewM, d); dt.setHours(0,0,0,0);
      const isPast = dt < today;
      const slots = isPast ? [] : slotsFor(viewY, viewM, d);
      if (isPast) el.classList.add('past');
      else if (slots.length === 0) el.classList.add('full');
      else {
        el.classList.add('av');
        if (slots.length === 1) { el.classList.add('almost'); el.dataset.tooltip = '1 créneau restant'; }
        else { el.dataset.tooltip = slots.length + ' créneaux disponibles'; }
        el.setAttribute('aria-label', (slots.length === 1 ? '1 créneau restant' : slots.length + ' créneaux disponibles') + ' le ' + d);
        el.dataset.y = viewY; el.dataset.m = viewM; el.dataset.d = d;
        el.addEventListener('click', () => selectDate(el));
      }
      bkCal.appendChild(el);
    }
    // Prev button disabled if viewing current month
    bkPrev.classList.toggle('disabled', viewY === today.getFullYear() && viewM === today.getMonth());
  }

  function findNextAvailable(){
    // Search up to 60 days ahead
    const d = new Date(today);
    for (let i=0; i<60; i++){
      const s = slotsFor(d.getFullYear(), d.getMonth(), d.getDate());
      if (s.length) return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), slots: s };
      d.setDate(d.getDate()+1);
    }
    return null;
  }

  function updateNextSlotBadge(){
    const n = findNextAvailable();
    if (!n || !bkNextSlot) return;
    const dt = new Date(n.y, n.m, n.d);
    const dayName = DAYS()[dt.getDay()];
    bkNextSlot.textContent = dayName+' '+n.d+' '+MONTHS()[n.m];
  }

  bkPrev.addEventListener('click', () => {
    if (viewY === today.getFullYear() && viewM === today.getMonth()) return;
    viewM--; if (viewM < 0){ viewM = 11; viewY--; }
    renderMonth();
  });
  bkNext.addEventListener('click', () => {
    viewM++; if (viewM > 11){ viewM = 0; viewY++; }
    renderMonth();
  });

  renderMonth();
  updateNextSlotBadge();

  // Pre-select next available date in current view (or first dispo next month if none)
  const firstAv = bkCal.querySelector('.bk-d.av');
  if (firstAv) selectDate(firstAv);
  else {
    // jump to next month that has availability
    const n = findNextAvailable();
    if (n){
      viewY = n.y; viewM = n.m;
      renderMonth();
      const target = bkCal.querySelector('.bk-d.av[data-d="'+n.d+'"]');
      if (target) selectDate(target);
    }
  }

  // Step 1 → 2
  bkN1.addEventListener('click', () => { if (selectedD && selectedTime) setStep(2); });
  bkN2.addEventListener('click', () => setStep(3));
  bkB2.addEventListener('click', () => setStep(1));

  window._calRebuild = function(lang) {
    calLang = lang;
    renderMonth();
    updateNextSlotBadge();
    if (selectedD !== null) renderSlots(selectedY, selectedMo, selectedD);
  };
})();

// ===== SIMULATEUR D'ÉCONOMIES (dual mode) =====
(function() {
  const vol = document.getElementById('simVol');
  const cost = document.getElementById('simCost');
  const basket = document.getElementById('simBasket');
  const comm = document.getElementById('simComm');
  const volVal = document.getElementById('simVolVal');
  const costVal = document.getElementById('simCostVal');
  const basketVal = document.getElementById('simBasketVal');
  const commVal = document.getElementById('simCommVal');
  const amount = document.getElementById('simAmount');
  const detail = document.getElementById('simDetail');
  const offerBadge = document.querySelector('#simOffer .sim-offer-badge');
  const modeWrap = document.querySelector('.sim-mode-wrap');
  const modeBtns = document.querySelectorAll('.sim-mode-btn');
  const fieldsFixed = document.querySelectorAll('.sim-mode-fixed');
  const fieldsComm = document.querySelectorAll('.sim-mode-commission');
  const goodBlock = document.getElementById('simGood');
  const neutralBlock = document.getElementById('simNeutral');
  if (!vol) return;

  let mode = 'fixed'; // 'fixed' | 'commission'

  // Tarifs pilotables depuis le back-office (source unique). Repli sur les valeurs par défaut.
  function pricingCfg(){ let c = window.CHASKIS_PRICING; if(!c){ try{ c = JSON.parse(localStorage.getItem('chaskis_pricing')); }catch(e){} } return c; }
  function getChaskisRate(v) {
    const c = pricingCfg();
    if (c && Array.isArray(c.tiers)) { for (var i=0;i<c.tiers.length;i++){ var t=c.tiers[i]; if (t.max==null || v < t.max) return { rate: t.rate, plan: t.plan }; } }
    if (v < 10) return { rate: 16, plan: 'Express' };
    if (v < 40) return { rate: 12, plan: 'Flex' };
    return { rate: 8, plan: 'Dédié' };
  }
  function fmtCHF(n) {
    return "CHF " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }
  function updateFill(el) {
    if (!el) return;
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--fill', pct + '%');
  }

  function setMode(next){
    mode = next;
    modeWrap.setAttribute('data-mode', next);
    modeBtns.forEach(b => {
      const active = b.dataset.mode === next;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    fieldsFixed.forEach(el => el.hidden = (next !== 'fixed'));
    fieldsComm.forEach(el => el.hidden = (next !== 'commission'));
    update();
  }

  function update() {
    const v = +vol.value;
    const { rate, plan } = getChaskisRate(v);
    const _pc = pricingCfg();
    const days = (_pc && _pc.days) || 22;
    const lang = window._currentLang || 'fr';
    const isEn = lang === 'en';

    let currentCostPerCourse;
    let basisText;
    if (mode === 'fixed'){
      currentCostPerCourse = +cost.value;
      costVal.textContent = 'CHF ' + currentCostPerCourse;
      basisText = isEn
        ? `${v} delivery/day × ${days} working days at CHF ${currentCostPerCourse}/delivery`
        : `${v} course${v>1?'s':''}/jour × ${days} jours à CHF ${currentCostPerCourse}/course`;
    } else {
      const b = +basket.value;
      const p = +comm.value;
      currentCostPerCourse = b * p / 100;
      basketVal.textContent = 'CHF ' + b;
      commVal.textContent = p + ' %';
      basisText = isEn
        ? `Basket CHF ${b} × ${p}% commission, ${v} order${v>1?'s':''}/day × ${days} days`
        : `Panier ${b} CHF × ${p}% de commission, ${v} commande${v>1?'s':''}/jour × ${days} jours`;
    }
    volVal.textContent = isEn
      ? v + (v > 1 ? ' deliveries' : ' delivery') + '/day'
      : v + ' livraison' + (v > 1 ? 's' : '') + '/jour';

    const saving = (currentCostPerCourse - rate) * v * days;

    if (saving > 0){
      goodBlock.hidden = false;
      neutralBlock.hidden = true;
      amount.textContent = fmtCHF(saving);
      detail.innerHTML = `<span class="ast">*</span> ${basisText}`;
      if (offerBadge){
        offerBadge.textContent = isEn
          ? `${plan} · CHF ${rate}/delivery`
          : `${plan} · CHF ${rate}/livraison`;
        offerBadge.dataset.plan = plan;
      }
    } else {
      goodBlock.hidden = true;
      neutralBlock.hidden = false;
    }

    updateFill(vol);
    updateFill(cost);
    updateFill(basket);
    updateFill(comm);
  }

  vol.addEventListener('input', update);
  cost && cost.addEventListener('input', update);
  basket && basket.addEventListener('input', update);
  comm && comm.addEventListener('input', update);
  modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  update();
  window._simUpdate = update;
})();

// ===== HERO 3D CARD PARALLAX =====
// Floating CTA: apparaît quand le CTA hero sort du viewport
const floatCta = document.querySelector('.nav-cta-float');
const heroCta = document.querySelector('.hero-actions');
if (floatCta && heroCta) {
  new IntersectionObserver(([e]) => floatCta.classList.toggle('visible', !e.isIntersecting)).observe(heroCta);
}

// Hero photo parallax & tilt
const heroVis = document.getElementById('heroVis');
if (heroVis) {
  const photoWrap = heroVis.querySelector('.hv-photo-wrap');
  if (photoWrap && window.matchMedia('(hover:hover)').matches) {
    heroVis.addEventListener('mousemove', e => {
      const rect = heroVis.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      photoWrap.style.transform = `rotateY(${x * 10}deg) rotateX(${y * -6}deg) scale(1.03)`;
    });
    heroVis.addEventListener('mouseleave', () => { photoWrap.style.transform = ''; });
  }
}

// ===== ZOOM PARALLAX =====
const zoomBg = document.getElementById('zoomBg');
if (zoomBg) {
  window.addEventListener('scroll', () => {
    const sect = zoomBg.parentElement;
    const rect = sect.getBoundingClientRect();
    const prog = -rect.top / (rect.height + window.innerHeight);
    zoomBg.style.transform = `scale(${1 + prog * 0.08}) translateY(${prog * 20}px)`;
  }, { passive: true });
}

// Observe .vpc and .pipe-step (custom animated elements not covered by assets/js/shared.js selector)
const extraReveal = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('v'); extraReveal.unobserve(e.target); } });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.vpc, .pipe-step').forEach(el => extraReveal.observe(el));

// PAGE TRANSITION : géré par assets/js/shared.js

// ===== NAV DARK DETECTION (auto, no manual tagging needed) =====
(function() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  function luminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function parseColor(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (!m) return null;
    const alpha = m[4] !== undefined ? +m[4] : 1;
    if (alpha < 0.25) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function getElColor(el) {
    const style = getComputedStyle(el);
    // 1. Try background-color
    const col = parseColor(style.backgroundColor);
    if (col) return col;
    // 2. Gradient: extract first color from background-image
    const img = style.backgroundImage;
    if (img && img !== 'none') return parseColor(img);
    return null;
  }

  function check() {
    const navH = nav.offsetHeight;
    const candidates = document.querySelectorAll(
      'header, section, footer, .hero, .zoom-section, .pipeline, .recruit, [data-nav-dark]'
    );
    let isDark = false;

    candidates.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top >= navH || rect.bottom <= 0) return;
      const col = getElColor(el);
      if (col && luminance(col.r, col.g, col.b) < 0.38) isDark = true;
    });

    nav.classList.toggle('over-dark', isDark);
  }

  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check, { passive: true });
  // Run after first paint so computed styles are ready
  requestAnimationFrame(check);
})();

// ===== I18N =====
const T = {
  fr: {
    'stat1': 'Coursiers en CDI', 'stat2': 'Livraisons par an', 'stat3': 'Villes en Suisse romande',
    'diff.label': 'Pourquoi Chaskis', 'diff.h2': 'La livraison professionnelle,<br><span class="ac">sans les compromis habituels</span>', 'diff.p': 'Pour toute entreprise qui veut externaliser ses livraisons à un partenaire fiable, sans commission, sans mauvaise surprise.',
    'diff1.h3': 'Coursiers salariés,<br>toujours au rendez-vous', 'diff1.p': 'Formés à votre image, équipés à vos couleurs.',
    'diff1.li1': 'Remplacement garanti en cas d\'absence', 'diff1.li2': 'Pas de freelances ni de turnover', 'diff1.li3': 'Assurés et encadrés en interne',
    'diff2.h3': 'Tarif fixe,<br>coût maîtrisé', 'diff2.p': 'Un coût que vous contrôlez, pas un pourcentage prélevé sur chaque vente.',
    'diff2.li1': 'Jusqu\'à CHF 8 / livraison, dégressif selon volume', 'diff2.li2': 'Tarif fixe, défini à l\'avance', 'diff2.li3': 'Zéro commission sur vos ventes',
    'diff3.h3': 'Zéro coordination<br>de votre côté', 'diff3.lead': 'Passez une commande.<br>On s\'occupe du reste.',
    'diff3.li1': 'Dispatch pris en charge à chaque commande', 'diff3.li2': 'Un interlocuteur dédié à votre compte', 'diff3.li3': 'Confirmation de livraison à chaque course',
    'feat.fm.label': 'Suivi de livraison',
    'feat.step0': 'Commande reçue · <strong>14:08</strong>', 'feat.step1': 'Coursier assigné · <strong>14:10</strong>',
    'feat.step2': 'Point A : en attente', 'feat.step3': 'Point B : en attente',
    'feat.label': 'Ce que ça change pour vous', 'feat.h2': 'Tout est <span class="ac">inclus</span>', 'feat.sd': 'On se connecte à vos outils, on gère la logistique.<br>Tout est compris dès la première commande.',
    'feat1.text': '<h3>Dispatch automatique</h3><p>Commande transmise → coursier assigné → destinataire notifié par SMS.<br>Sans un appel, sans une relance.</p>',
    'feat2.text': '<h3>Preuve de livraison systématique</h3><p>Photo de livraison après chaque course.<br>Trace irréfutable, zéro contestation possible.</p>',
    'feat3.text': '<h3>Multi-stops et créneaux sur-mesure</h3><p>Express ou planifié, une adresse ou vingt.<br>On s\'adapte à votre volume et à vos horaires.</p>',
    'feat4.text': '<h3>Votre marque, pas Chaskis</h3><p>Tenue, matériel et communication à vos couleurs.<br>Disponible dans l\'offre Dédiée.</p>',
    'feat5.text': '<h3>Adapté à votre secteur</h3><p>Pharmacies, cabinets médicaux, commerces, bureaux, ateliers... chaque métier a ses contraintes, on s\'adapte à toutes.</p>',
    'sim.pt1': 'Tarif fixe dès <strong>CHF 8</strong> par livraison', 'sim.pt2': 'Zéro commission sur vos ventes', 'sim.pt3': 'Dégressif selon votre volume quotidien',
    'sim.cta': 'Calculer mon tarif exact',
    'sim.lbl.vol': 'Livraisons par jour', 'sim.lbl.cost': 'Coût moyen actuel par course (CHF)', 'sim.lbl.basket': 'Panier moyen (CHF)', 'sim.lbl.comm': 'Commission actuelle (%)',
    'sim.result.savings': 'Économie mensuelle estimée', 'sim.result.offer.label': '<span class="ast">*</span> Offre recommandée',
    'sim.result.profile': 'Sur votre profil actuel', 'sim.disclaimer': 'Estimation indicative, ne fait pas office de devis.',
    'sim.label': 'Simulateur d\'économies', 'sim.h2': 'Quel est le vrai <span class="ac">coût</span> de vos livraisons ?', 'sim.p': 'Entre commissions, frais cachés et majorations variables, vos livraisons coûtent plus cher qu\'elles ne le laissent paraître. Comparez avec nos tarifs fixes, basés sur votre volume réel.',
    'sim.mode.fixed': 'Tarif fixe par course', 'sim.mode.comm': 'Commission sur ventes',
    'sim.neutral.title': 'Chaskis n\'est pas systématiquement plus avantageux.', 'sim.neutral.p': 'Vos conditions actuelles sont déjà serrées. Pour savoir si nos tarifs dégressifs peuvent changer la donne sur une partie de vos commandes, parlons-en 20 minutes.',
    'sim.neutral.cta': 'Réserver l\'analyse <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
    'offres.label': 'Nos offres', 'offres.h2': 'Choisissez votre <span class="ac">formule</span>', 'offres.sd': 'Sans engagement. Flex s\'adapte à vos volumes qui fluctuent, Dédié prend le relais quand ils se stabilisent.',
    'offre.flex.ideal': 'Un service régulier qui s\'adapte à votre rythme',
    'offre.dedie.ideal': 'Fort volume quotidien : votre flotte, sans la gérer',
    'offre.express.ideal': 'Une course ponctuelle, sans compte ni engagement',
    'offre.price.from': 'à partir de', 'offre.price.unit': 'Commande',
    'offre.badge.recommended': 'Recommandé',
    'offre.spec.wait': 'Temps d\'attente', 'offre.spec.billing': 'Tarification', 'offre.spec.degr': 'Dégressif', 'offre.spec.commit': 'Engagement',
    'offre.val.no': 'Non', 'offre.val.yes': 'Oui',
    'offre.cta.quote': 'Demander une offre',
    'flex.li1': 'Sans engagement, sans durée minimale', 'flex.li2': 'Prise en charge sous 5-15 min', 'flex.li3': 'Suivi temps réel + notifications client', 'flex.li4': 'Tarif dégressif selon votre volume',
    'flex.spec.wait': '5-15 min', 'flex.spec.billing': 'À la commande', 'flex.spec.degr': 'Selon le volume moyen', 'flex.note': 'Pour 3.5 commandes par heure',
    'dedie.li1': 'Flotte et planning dédiés à votre activité', 'dedie.li2': 'Account manager attitré', 'dedie.li3': 'Coursier équipé à votre image', 'dedie.li4': 'Remplacement garanti en cas d\'absence', 'dedie.li5': 'Disponibilité immédiate, zéro attente',
    'dedie.spec.wait': 'Aucun', 'dedie.spec.billing': 'À l\'heure', 'dedie.spec.degr': 'Selon le volume horaire', 'dedie.note': 'Pour 6 commandes par heure',
    'express.li1': 'Sans contrat, sans engagement', 'express.li2': 'Commande en ligne, paiement immédiat', 'express.li3': 'Prise en charge sous 30-45 min', 'express.li4': 'Suivi en temps réel inclus',
    'express.spec.wait': '30-45 min', 'express.spec.billing': 'Au kilomètre', 'express.spec.degr': 'Selon la distance', 'express.btn': 'Commander maintenant', 'express.note': 'Pour une distance d\'1 km',
    'hero.w1': 'On', 'hero.w2': 'gère', 'hero.w3': 'vos', 'hero.w4': 'livraisons,',
    'hero.w5': 'vous', 'hero.w6': 'gérez', 'hero.w7': 'votre', 'hero.w8': 'business',
    'hero.overline': '6 créneaux disponibles cette semaine',
    'hero.sub': 'Livraison professionnelle en Suisse romande. Coursiers salariés, tarifs fixes, traçabilité complète : le partenaire logistique des entreprises suisses.',
    'hero.cta1': 'Planifier un appel gratuit', 'hero.cta2': 'Commander une course',
    'hero.stat1': 'Délai moyen', 'hero.stat2': 'vs plateformes', 'hero.stat3': 'Coursiers CDI', 'hero.stat4': 'Courses / an',
    'partners.headline': 'entreprises nous font confiance',
    'zoom.h2': 'La livraison pro, <span class="accent">sans les galères</span>',
    'zoom.p': 'Tarifs fixes, coursiers salariés CDI, suivi en temps réel. Chaskis est le partenaire logistique conçu pour les entreprises de Suisse romande qui veulent de la fiabilité, pas des mauvaises surprises.',
    'bento.label': 'Nos services', 'bento.h2': 'Tout ce dont votre logistique a <span class="ac">besoin</span>',
    'bento1.h3': 'Coursiers & chauffeurs salariés', 'bento1.p': 'Vélo pour la zone urbaine, voiture pour les colis lourds ou longues distances. 800 employés CDI, formés & assurés. Pas d\'auto-entrepreneurs.',
    'bento2.h3': 'Import CSV & API', 'bento2.p': 'Connectez votre POS, WooCommerce ou Shopify. Commandes en masse par CSV. Zéro ressaisie.',
    'bento3.h3': 'Tournées multi-stops', 'bento3.p': 'Optimisez vos tournées de livraison. Ajoutez autant de points que nécessaire, l\'itinéraire est recalculé en temps réel.',
    'bento4.h3': 'Dashboard & analytics', 'bento4.p': 'Tableau de bord en temps réel, historique des courses, rapports mensuels, KPIs de performance.',
    'bento5.h3': 'Proof of Delivery', 'bento5.p': 'Photo ou signature électronique à chaque remise. Horodaté, géolocalisé, stocké dans votre espace client. Litige? Vous avez la preuve.',
    'testi.label': 'Témoignages', 'testi.h2': 'Ce qu\'en disent nos <span class="ac">clients</span>',
    'sec.label': 'Pour qui', 'sec.h2': 'Vos secteurs, <span class="ac">nos spécialités</span>', 'sec.p': 'Chaque secteur a ses contraintes. Nos livreurs sont formés aux protocoles spécifiques de chaque industrie.',
    'sec1.h3': 'Médical & Pharma', 'sec1.tag': 'Délai critique · Chaîne du froid',
    'sec1.uses': '<li>Ordonnances &amp; médicaments urgents</li><li>Résultats d\'analyses &amp; prélèvements</li><li>Matériel médical entre cliniques</li><li>Transport température contrôlée</li>',
    'sec2.h3': 'Luxe & Bijouterie', 'sec2.tag': 'Remise en main propre · Discrétion',
    'sec2.uses': '<li>Bijoux &amp; montres (assurance incluse)</li><li>Colis luxe avec signature obligatoire</li><li>Livraison en tenue professionnelle</li><li>Proof of delivery photo systématique</li>',
    'sec3.h3': 'Juridique & Notarial', 'sec3.tag': 'Confidentialité · Preuve de remise',
    'sec3.uses': '<li>Documents confidentiels &amp; actes notariés</li><li>Contrats signés entre études</li><li>Plis recommandés urgents</li><li>Tournées quotidiennes planifiées</li>',
    'sec4.h3': 'E-commerce & Retail', 'sec4.tag': 'Volume · CSV · API',
    'sec4.uses': '<li>Import CSV de commandes en masse</li><li>Intégration API Shopify / WooCommerce</li><li>Tournées multi-colis optimisées</li><li>Notifications clients automatiques</li>',
    'sec.cta.discuss': 'Discuter de vos besoins', 'sec.cta.order': 'Commander maintenant',
    'why.label': 'Pourquoi Chaskis', 'why.h2': 'Vos livraisons méritent <span class="ac">mieux</span> qu\'une plateforme', 'why.p': 'Les plateformes prennent 30% de commission. Nous proposons un tarif fixe avec une équipe dédiée et zéro appel de dispatch.',
    'vpc1.h3': '-40% sur vos coûts', 'vpc1.p': 'Tarif fixe dès CHF 8/course. Sans commission, sans frais cachés. Vos marges restent vos marges.', 'vpc1.big': '-40%',
    'vpc2.h3': 'Zéro gestion manuelle', 'vpc2.p': 'Paiement Stripe → course créée → livreur assigné → SMS envoyé. Tout en automatique, sans intervention humaine.', 'vpc2.big': '0 appel',
    'vpc3.h3': 'Fiabilité suisse', 'vpc3.p': '800 coursiers salariés (pas auto-entrepreneurs), formation interne, assurance complète et preuve de livraison sur chaque course.', 'vpc3.big': 'CDI',
    'pipe.label': 'Le flux automatisé', 'pipe.h2': 'De la commande à la <span style="color:var(--teal-light)">livraison</span>, sans vous', 'pipe.p': 'Voici ce qui se passe quand un client passe commande. Zéro intervention humaine côté Chaskis, 100% traçable.',
    'pipe.auto': 'Automatique',
    'pipe1.n': 'Étape 1', 'pipe1.h3': 'Client commande', 'pipe1.p': 'Via le formulaire web, votre API ou un import CSV. Référence marchand obligatoire pour identifier le colis.',
    'pipe2.n': 'Étape 2', 'pipe2.h3': 'Stripe confirme', 'pipe2.p': 'Paiement chiffré. Dès validation, un webhook déclenche automatiquement le process en backend.',
    'pipe3.n': 'Étape 3', 'pipe3.h3': 'Dispatch automatique', 'pipe3.p': 'Shipday crée la tâche et assigne le coursier disponible le plus proche. Zéro appel, zéro coordination manuelle.',
    'pipe4.n': 'Étape 4', 'pipe4.h3': 'Livreur s\'identifie', 'pipe4.p': 'Le coursier utilise la référence marchand pour s\'identifier au point de retrait. Le commerçant reçoit un SMS d\'annonce.',
    'pipe5.n': 'Étape 5', 'pipe5.h3': 'Suivi GPS en direct', 'pipe5.p': 'Client et expéditeur reçoivent un lien de tracking en temps réel. Notifications automatiques à chaque étape clé.',
    'pipe6.n': 'Étape 6', 'pipe6.h3': 'Proof of Delivery', 'pipe6.p': 'L\'app livreur exige une photo ou signature pour clôturer la course. Preuve horodatée disponible dans votre dashboard.',
    'how.label': 'Comment démarrer', 'how.h2': 'Un onboarding <span class="ac">clé en main</span>', 'how.p': 'De l\'appel découverte à votre première livraison, on gère tout le setup.',
    'how1.h3': 'Appel découverte (20 min)', 'how1.p': 'On comprend votre volume, vos secteurs, vos contraintes. On propose le bon plan : Express, Flex ou Dédié.',
    'how2.h3': 'Setup technique', 'how2.p': 'Création du compte, config API ou import CSV, connexion Stripe, paramétrage Shipday. On gère tout.',
    'how3.h3': 'Première course test', 'how3.p': 'On effectue une course en conditions réelles pour valider le flux complet : commande → dispatch → POD.',
    'how4.h3': 'Go live & optimisation', 'how4.p': 'Dashboard actif, coursiers dédiés assignés, analytics hebdomadaires. Vous n\'avez plus à penser à la logistique.',
    'recruit.h2': 'Rejoignez les <span class="purple">800+ coursiers</span> qui ont choisi Chaskis',
    'recruit.p': 'CDI, horaires flexibles, matériel fourni, assurance complète. Un vrai job, pas une mission freelance.',
    'recruit.b1': 'CDI', 'recruit.b2': 'Horaires flex', 'recruit.b3': 'Assuré', 'recruit.b4': 'Matériel fourni',
    'recruit.cta': 'Découvrir les postes',
    'booking.label': 'Démarrer avec Chaskis', 'booking.h2': 'Votre consultation logistique <span class="sa">offerte</span>', 'booking.p': '20 minutes de conseil stratégique avec un expert. On audite vos flux, on identifie les leviers d\'optimisation, on vous livre un plan d\'action concret.',
    'bk.urgency.label': 'Prochain créneau :',
    'bk.slots.avail': 'Créneaux disponibles', 'bk.slots.full': 'Complet ce jour', 'bk.slots.last': 'Plus qu\'un créneau', 'bk.slots.few': 'Quelques créneaux restants',
    'bk.testi0.text': '"En 20 min, on avait un plan clair. 2 semaines plus tard, tout était live."', 'bk.testi0.co': 'Pharmacie du Lac, Genève',
    'bk.testi1.text': '"L\'audit a mis en lumière des coûts qu\'on ne voyait même pas. On a économisé 22% dès le premier mois."', 'bk.testi1.co': 'Swiss E-Shop, Neuchâtel',
    'bk.testi2.text': '"Appel clair, sans bla-bla. Recommandation concrète, chiffrée, on savait quoi faire."', 'bk.testi2.co': 'Maison Bulgari, Genève',
    'bk.check1': 'Audit complet de vos coûts de livraison', 'bk.check2': 'Recommandation tarifaire personnalisée', 'bk.check3': 'Plan de déploiement clé en main',
    'perk1.h4': '20 min chrono', 'perk1.p': 'On respecte votre temps.',
    'perk2.h4': 'Sans engagement', 'perk2.p': 'On discute, vous décidez.',
    'perk3.h4': 'Tarif sur mesure', 'perk3.p': 'Adapté à votre volume et secteur.',
    'bk.step1.t': 'Choisissez une date', 'bk.step1.s': 'Avril 2026',
    'bk.next': 'Suivant',
    'bk.step2.t': 'Quelques infos', 'bk.step2.s': 'Pour préparer l\'appel',
    'bk.f.first': 'Prénom', 'bk.f.first.ph': 'Jean', 'bk.f.last': 'Nom', 'bk.f.last.ph': 'Dupont',
    'bk.f.email': 'Email pro', 'bk.f.company': 'Entreprise', 'bk.f.company.ph': 'Pharmacie du Lac',
    'bk.f.vol': 'Volume estimé / jour',
    'bk.f.vol.opts': '<option>Moins de 10</option><option>10 à 30</option><option>30 à 100</option><option>Plus de 100</option>',
    'bk.f.sector': 'Votre secteur',
    'bk.f.sector.opts': '<option>E-commerce / Retail</option><option>Médical / Pharma</option><option>Luxe / Bijouterie</option><option>Juridique / Notarial</option><option>Restauration</option><option>Autre</option>',
    'bk.back': 'Retour', 'bk.confirm': 'Confirmer',
    'bk.step3.h3': 'C\'est réservé !', 'bk.step3.p': 'Confirmation par email. À très vite !',
    'faq.sl': 'FAQ',
    'faq.h2': 'Vos questions, nos <span class="ac">réponses</span>',
    'faq.sd': 'Pas trouvé ? <a href="#booking" style="color:var(--teal);font-weight:700">Planifiez un appel</a>.',
    'faq1.q': 'Quelle formule correspond à mes besoins ?', 'faq1.a': '<p>Ça dépend de la régularité de votre flux, pas de votre taille.</p><ul><li><span class="faq-badge">Dédié</span><span>Flux quotidien et stable. Coursier attitré, coût par course le plus bas.</span></li><li><span class="faq-badge b-purple">Flex</span><span>Volume qui fluctue. Vous payez à la commande, sans engagement.</span></li><li><span class="faq-badge b-ink">Express</span><span>Besoin isolé. Commandé à l\'unité depuis notre site, sans compte.</span></li></ul><p>Pas sûr ? Notre simulateur vous recommande la bonne formule en 30 secondes.</p>',
    'faq2.q': 'Comment mes clients passent-ils commande ?', 'faq2.a': '<p>Par vos canaux habituels. Vos clients continuent de commander comme avant : en boutique, par téléphone, sur votre site, votre app, WhatsApp, ou via les plateformes (Uber Eats, Smood, Just Eat…).</p><p>Chaskis ne remplace pas votre outil de commande. On prend le relais une fois la commande passée, pour la livrer. Vous gardez la main sur votre marque et votre relation client.</p>',
    'faq3.q': 'Comment je vous transmets mes commandes ?', 'faq3.a': '<p>Trois options selon votre setup.</p><ul><li><span class="faq-badge">API</span><span>Synchronisation automatique de vos commandes avec notre dispatch. Le cas le plus courant.</span></li><li><span class="faq-badge b-purple">Import</span><span>Pour les flux groupés, envoyés par fichier.</span></li><li><span class="faq-badge b-ink">Dashboard</span><span>Saisie manuelle pour les commandes exceptionnelles (appel, walk-in).</span></li></ul><p>On gère toute la mise en place technique au démarrage. Vous n\'avez rien à coder.</p>',
    'faq4.q': 'Et si un coursier est malade ou indisponible ?', 'faq4.a': '<p><strong>Remplacement garanti.</strong> C\'est notre problème, pas le vôtre.</p><p>Nos coursiers sont salariés, pas freelances. On gère les absences en interne. Si votre coursier dédié est en congé ou malade, un autre prend le relais le jour même, déjà formé à vos standards.</p><p>Contrairement aux plateformes freelance, vous ne subissez ni annulations de dernière minute, ni coursier introuvable.</p>',
    'faq5.q': 'Casse, perte, litige : comment vous gérez ?', 'faq5.a': '<p>Chaque livraison est tracée et assurée.</p><p>À la prise en charge comme à la remise, le coursier fait une preuve horodatée (photo ou signature). En cas de litige, on retrouve l\'étape concernée en quelques minutes.</p><p>Les livraisons sont couvertes par une assurance, avec un plafond rehaussé pour le luxe, le pharma et le juridique. Tout est documenté dans votre dashboard.</p>',
    'faq6.q': 'Quelles zones et quels types de colis ?', 'faq6.a': '<p><strong>Zones couvertes :</strong> Genève, Nyon, Lausanne et la Riviera.</p><ul><li><span class="faq-badge">Sac coursier</span><span>Format standard, type Uber Eats. Pour documents, plis, petits colis.</span></li><li><span class="faq-badge b-purple">Coffre de voiture</span><span>Pour les livraisons plus volumineuses.</span></li></ul><p>On adapte le protocole (température, confidentialité, preuve renforcée) à votre secteur : pharma, alimentaire, luxe, juridique. Un besoin hors-standard ? On en discute à l\'appel découverte.</p>',
    'faq7.q': 'Je peux changer de formule en cours de route ?', 'faq7.a': '<p>Oui, sans friction, entre <strong>Flex</strong> et <strong>Dédié</strong>.</p><p>Vous démarrez en Flex et votre volume grandit ? On bascule en Dédié dès que ça devient rentable pour vous. À l\'inverse, si l\'activité ralentit, on repasse en Flex sans pénalité.</p><p>L\'Express n\'est pas vraiment une formule : c\'est le service de base, commandé directement depuis notre site, sans compte. Vous pouvez l\'utiliser ponctuellement en complément, quelle que soit votre formule.</p>',
    'faq.sd.left': 'Une question ? On y répond ici. Sinon, appelez-nous ou passez nous voir.',
    'foot.tag': 'Livraison, mobilité et infrastructure logistique pour les entreprises de Suisse romande.',
    'foot.svc.h': 'Services', 'foot.svc.1': 'Commander', 'foot.svc.2': 'Tableau de bord', 'foot.svc.3': 'Nos secteurs', 'foot.svc.4': 'Planifier un appel',
    'foot.co.h': 'Entreprise', 'foot.co.1': 'Postuler',
    'foot.leg.h': 'Légal', 'foot.leg.1': 'Mentions légales', 'foot.leg.2': 'Confidentialité', 'foot.leg.3': 'CGV',
    'foot.made': 'Fait en Suisse romande',
    'float.cta': 'Planifier un appel',
  },
  en: {
    'stat1': 'Employed couriers', 'stat2': 'Deliveries per year', 'stat3': 'Cities in French Switzerland',
    'diff.label': 'Why Chaskis', 'diff.h2': 'Professional delivery,<br><span class="ac">without the usual trade-offs</span>', 'diff.p': 'For any business that wants to outsource its deliveries to a reliable partner. No commission, no surprises.',
    'diff1.h3': 'Employed couriers,<br>always on time', 'diff1.p': 'Trained to your standards, equipped in your brand.',
    'diff1.li1': 'Guaranteed replacement in case of absence', 'diff1.li2': 'No freelancers, no turnover', 'diff1.li3': 'Insured and managed in-house',
    'diff2.h3': 'Fixed rate,<br>controlled costs', 'diff2.p': 'A cost you control, not a percentage taken from every sale.',
    'diff2.li1': 'From CHF 8 / delivery, tiered by volume', 'diff2.li2': 'Fixed rate, set in advance', 'diff2.li3': 'Zero commission on your sales',
    'diff3.h3': 'Zero coordination<br>on your end', 'diff3.lead': 'Place an order.<br>We handle the rest.',
    'diff3.li1': 'Dispatch handled on every order', 'diff3.li2': 'A dedicated contact for your account', 'diff3.li3': 'Delivery confirmation after every run',
    'feat.fm.label': 'Delivery tracking',
    'feat.step0': 'Order received · <strong>14:08</strong>', 'feat.step1': 'Courier assigned · <strong>14:10</strong>',
    'feat.step2': 'Point A: waiting', 'feat.step3': 'Point B: waiting',
    'feat.label': 'What changes for you', 'feat.h2': 'Everything is <span class="ac">included</span>', 'feat.sd': 'We connect to your tools, we manage the logistics.<br>Everything is covered from your very first order.',
    'feat1.text': '<h3>Automatic dispatch</h3><p>Order placed → courier assigned → recipient notified by SMS.<br>No calls, no follow-ups.</p>',
    'feat2.text': '<h3>Systematic proof of delivery</h3><p>Photo after every delivery.<br>Irrefutable record, zero disputes.</p>',
    'feat3.text': '<h3>Multi-stop & custom time slots</h3><p>Express or scheduled, one address or twenty.<br>We adapt to your volume and your hours.</p>',
    'feat4.text': '<h3>Your brand, not Chaskis</h3><p>Uniform, equipment and communication in your colours.<br>Available with the Dedicated plan.</p>',
    'feat5.text': '<h3>Adapted to your sector</h3><p>Pharmacies, medical practices, shops, offices, workshops... every trade has its constraints, we adapt to all of them.</p>',
    'sim.pt1': 'Fixed rate from <strong>CHF 8</strong> per delivery', 'sim.pt2': 'Zero commission on your sales', 'sim.pt3': 'Tiered pricing based on your daily volume',
    'sim.cta': 'Calculate my exact rate',
    'sim.lbl.vol': 'Deliveries per day', 'sim.lbl.cost': 'Current average cost per delivery (CHF)', 'sim.lbl.basket': 'Average basket (CHF)', 'sim.lbl.comm': 'Current commission (%)',
    'sim.result.savings': 'Estimated monthly savings', 'sim.result.offer.label': '<span class="ast">*</span> Recommended plan',
    'sim.result.profile': 'Based on your current profile', 'sim.disclaimer': 'Indicative estimate only, not a binding quote.',
    'sim.label': 'Savings simulator', 'sim.h2': 'What is the real <span class="ac">cost</span> of your deliveries?', 'sim.p': 'Between commissions, hidden fees and variable surcharges, your deliveries cost more than they appear to. Compare with our fixed rates based on your actual volume.',
    'sim.mode.fixed': 'Fixed rate per delivery', 'sim.mode.comm': 'Commission on sales',
    'sim.neutral.title': 'Chaskis is not necessarily more competitive.', 'sim.neutral.p': 'Your current conditions are already tight. To find out whether our tiered pricing can make a difference on some of your orders, let\'s talk for 20 minutes.',
    'sim.neutral.cta': 'Book the analysis <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
    'offres.label': 'Our plans', 'offres.h2': 'Choose your <span class="ac">plan</span>', 'offres.sd': 'No commitment. Flex adapts to fluctuating volumes, Dedicated takes over once they stabilise.',
    'offre.flex.ideal': 'A regular service that adapts to your rhythm',
    'offre.dedie.ideal': 'High daily volume: your fleet, without managing it',
    'offre.express.ideal': 'A one-off delivery, no account needed',
    'offre.price.from': 'from', 'offre.price.unit': 'Order',
    'offre.badge.recommended': 'Recommended',
    'offre.spec.wait': 'Wait time', 'offre.spec.billing': 'Billing', 'offre.spec.degr': 'Tiered', 'offre.spec.commit': 'Commitment',
    'offre.val.no': 'No', 'offre.val.yes': 'Yes',
    'offre.cta.quote': 'Request a quote',
    'flex.li1': 'No commitment, no minimum duration', 'flex.li2': 'Pickup within 5 to 15 min', 'flex.li3': 'Real-time tracking + client notifications', 'flex.li4': 'Tiered pricing based on your volume',
    'flex.spec.wait': '5 to 15 min', 'flex.spec.billing': 'Per order', 'flex.spec.degr': 'Based on avg. volume', 'flex.note': 'For 3.5 orders per hour',
    'dedie.li1': 'Fleet and schedule dedicated to your business', 'dedie.li2': 'Dedicated account manager', 'dedie.li3': 'Courier equipped in your branding', 'dedie.li4': 'Guaranteed replacement in case of absence', 'dedie.li5': 'Immediate availability, zero wait',
    'dedie.spec.wait': 'None', 'dedie.spec.billing': 'Hourly', 'dedie.spec.degr': 'Based on hourly volume', 'dedie.note': 'For 6 orders per hour',
    'express.li1': 'No contract, no commitment', 'express.li2': 'Online order, immediate payment', 'express.li3': 'Pickup within 30 to 45 min', 'express.li4': 'Real-time tracking included',
    'express.spec.wait': '30 to 45 min', 'express.spec.billing': 'Per kilometre', 'express.spec.degr': 'Based on distance', 'express.btn': 'Order now', 'express.note': 'For a 1 km distance',
    'hero.w1': 'We', 'hero.w2': 'handle', 'hero.w3': 'your', 'hero.w4': 'deliveries,',
    'hero.w5': 'you', 'hero.w6': 'handle', 'hero.w7': 'your', 'hero.w8': 'business',
    'hero.overline': '6 slots available this week',
    'hero.sub': 'Professional delivery across French-speaking Switzerland. Employed couriers, fixed rates, full tracking: the logistics partner for Swiss businesses.',
    'hero.cta1': 'Schedule a free call', 'hero.cta2': 'Place an order',
    'hero.stat1': 'Avg. delivery', 'hero.stat2': 'vs platforms', 'hero.stat3': 'Employed couriers', 'hero.stat4': 'Deliveries / yr',
    'partners.headline': 'companies trust us',
    'zoom.h2': 'Professional delivery, <span class="accent">without the headaches</span>',
    'zoom.p': 'Fixed rates, full-time employed couriers, real-time tracking. Chaskis is the logistics partner built for Swiss businesses that need reliability, not surprises.',
    'bento.label': 'Our services', 'bento.h2': 'Everything your logistics <span class="ac">needs</span>',
    'bento1.h3': 'Employed couriers & drivers', 'bento1.p': 'Bike for urban zones, car for heavy parcels or longer distances. 800 full-time employees, trained & insured. No freelancers.',
    'bento2.h3': 'CSV import & API', 'bento2.p': 'Connect your POS, WooCommerce or Shopify. Bulk orders via CSV. Zero manual re-entry.',
    'bento3.h3': 'Multi-stop routes', 'bento3.p': 'Optimise your delivery rounds. Add as many stops as needed: the route is recalculated in real time.',
    'bento4.h3': 'Dashboard & analytics', 'bento4.p': 'Real-time dashboard, delivery history, monthly reports, performance KPIs.',
    'bento5.h3': 'Proof of Delivery', 'bento5.p': 'Photo or electronic signature at every handover. Time-stamped, geolocated, stored in your client portal. Dispute? You have the proof.',
    'testi.label': 'Testimonials', 'testi.h2': 'What our <span class="ac">clients</span> say',
    'sec.label': 'Who it\'s for', 'sec.h2': 'Your sectors, <span class="ac">our specialities</span>', 'sec.p': 'Every sector has its own constraints. Our couriers are trained in the specific protocols of each industry.',
    'sec1.h3': 'Medical & Pharma', 'sec1.tag': 'Critical timing · Cold chain',
    'sec1.uses': '<li>Urgent prescriptions &amp; medication</li><li>Lab results &amp; biological samples</li><li>Medical equipment between clinics</li><li>Temperature-controlled transport</li>',
    'sec2.h3': 'Luxury & Jewellery', 'sec2.tag': 'In-person handover · Discretion',
    'sec2.uses': '<li>Jewellery &amp; watches (insurance included)</li><li>Luxury parcels with mandatory signature</li><li>Delivery in professional attire</li><li>Systematic photo proof of delivery</li>',
    'sec3.h3': 'Legal & Notarial', 'sec3.tag': 'Confidentiality · Proof of handover',
    'sec3.uses': '<li>Confidential documents &amp; notarial deeds</li><li>Signed contracts between firms</li><li>Urgent registered letters</li><li>Planned daily rounds</li>',
    'sec4.h3': 'E-commerce & Retail', 'sec4.tag': 'Volume · CSV · API',
    'sec4.uses': '<li>Bulk CSV order imports</li><li>Shopify / WooCommerce API integration</li><li>Optimised multi-parcel rounds</li><li>Automated client notifications</li>',
    'sec.cta.discuss': 'Discuss your needs', 'sec.cta.order': 'Order now',
    'why.label': 'Why Chaskis', 'why.h2': 'Your deliveries deserve <span class="ac">better</span> than a platform', 'why.p': 'Platforms take 30% commission. We offer a fixed rate with a dedicated team and zero dispatch calls.',
    'vpc1.h3': '-40% on your costs', 'vpc1.p': 'Fixed rate from CHF 8/delivery. No commission, no hidden fees. Your margins stay yours.', 'vpc1.big': '-40%',
    'vpc2.h3': 'Zero manual management', 'vpc2.p': 'Stripe payment → delivery created → courier assigned → SMS sent. Fully automated, no human intervention.', 'vpc2.big': '0 call',
    'vpc3.h3': 'Swiss reliability', 'vpc3.p': '800 employed couriers (not freelancers), in-house training, full insurance and proof of delivery on every order.', 'vpc3.big': 'CDI',
    'pipe.label': 'The automated flow', 'pipe.h2': 'From order to <span style="color:var(--teal-light)">delivery</span>, hands-free', 'pipe.p': 'Here\'s what happens when a client places an order. Zero manual intervention on the Chaskis side, 100% traceable.',
    'pipe.auto': 'Automatic',
    'pipe1.n': 'Step 1', 'pipe1.h3': 'Client orders', 'pipe1.p': 'Via the web form, your API or a CSV import. Merchant reference required to identify the parcel.',
    'pipe2.n': 'Step 2', 'pipe2.h3': 'Stripe confirms', 'pipe2.p': 'Encrypted payment. Once validated, a webhook automatically triggers the backend process.',
    'pipe3.n': 'Step 3', 'pipe3.h3': 'Automatic dispatch', 'pipe3.p': 'Shipday creates the task and assigns the nearest available courier. Zero calls, zero manual coordination.',
    'pipe4.n': 'Step 4', 'pipe4.h3': 'Courier checks in', 'pipe4.p': 'The courier uses the merchant reference to identify themselves at the pickup point. The merchant receives an SMS notification.',
    'pipe5.n': 'Step 5', 'pipe5.h3': 'Live GPS tracking', 'pipe5.p': 'Client and sender receive a real-time tracking link. Automatic notifications at each key stage.',
    'pipe6.n': 'Step 6', 'pipe6.h3': 'Proof of Delivery', 'pipe6.p': 'The courier app requires a photo or signature to close the delivery. Time-stamped proof available in your dashboard.',
    'how.label': 'Getting started', 'how.h2': 'A turnkey <span class="ac">onboarding</span>', 'how.p': 'From discovery call to your first delivery, we handle the entire setup.',
    'how1.h3': 'Discovery call (20 min)', 'how1.p': 'We understand your volume, sectors and constraints. We propose the right plan: Express, Flex or Dedicated.',
    'how2.h3': 'Technical setup', 'how2.p': 'Account creation, API config or CSV import, Stripe connection, Shipday setup. We handle everything.',
    'how3.h3': 'First test delivery', 'how3.p': 'We run a live delivery to validate the full flow: order → dispatch → POD.',
    'how4.h3': 'Go live & optimisation', 'how4.p': 'Dashboard active, dedicated couriers assigned, weekly analytics. You no longer have to think about logistics.',
    'recruit.h2': 'Join the <span class="purple">800+ couriers</span> who chose Chaskis',
    'recruit.p': 'Permanent contract, flexible hours, equipment provided, full insurance. A real job, not a freelance gig.',
    'recruit.b1': 'Full-time', 'recruit.b2': 'Flex hours', 'recruit.b3': 'Insured', 'recruit.b4': 'Equipment provided',
    'recruit.cta': 'See open positions',
    'booking.label': 'Get started with Chaskis', 'booking.h2': 'Your complimentary <span class="sa">logistics consultation</span>', 'booking.p': '20 minutes of strategic advice with an expert. We audit your flows, identify levers for optimisation, and deliver a concrete action plan.',
    'bk.urgency.label': 'Next slot:',
    'bk.slots.avail': 'Available slots', 'bk.slots.full': 'Fully booked today', 'bk.slots.last': 'Last slot remaining', 'bk.slots.few': 'A few slots left',
    'bk.testi0.text': '"In 20 min we had a clear plan. Two weeks later, everything was live."', 'bk.testi0.co': 'Pharmacie du Lac, Geneva',
    'bk.testi1.text': '"The audit revealed costs we hadn\'t even noticed. We saved 22% from the very first month."', 'bk.testi1.co': 'Swiss E-Shop, Neuchâtel',
    'bk.testi2.text': '"Clear call, no fluff. Concrete, costed recommendation. We knew exactly what to do."', 'bk.testi2.co': 'Maison Bulgari, Geneva',
    'bk.check1': 'Full audit of your delivery costs', 'bk.check2': 'Personalised pricing recommendation', 'bk.check3': 'Turnkey deployment plan',
    'perk1.h4': '20 min max', 'perk1.p': 'We respect your time.',
    'perk2.h4': 'No commitment', 'perk2.p': 'We talk, you decide.',
    'perk3.h4': 'Custom pricing', 'perk3.p': 'Adapted to your volume and sector.',
    'bk.step1.t': 'Choose a date', 'bk.step1.s': 'April 2026',
    'bk.next': 'Next',
    'bk.step2.t': 'A few details', 'bk.step2.s': 'To prepare the call',
    'bk.f.first': 'First name', 'bk.f.first.ph': 'John', 'bk.f.last': 'Last name', 'bk.f.last.ph': 'Smith',
    'bk.f.email': 'Work email', 'bk.f.company': 'Company', 'bk.f.company.ph': 'My Company Ltd',
    'bk.f.vol': 'Est. volume / day',
    'bk.f.vol.opts': '<option>Less than 10</option><option>10 to 30</option><option>30 to 100</option><option>Over 100</option>',
    'bk.f.sector': 'Your sector',
    'bk.f.sector.opts': '<option>E-commerce / Retail</option><option>Medical / Pharma</option><option>Luxury / Jewellery</option><option>Legal / Notarial</option><option>Restaurants</option><option>Other</option>',
    'bk.back': 'Back', 'bk.confirm': 'Confirm',
    'bk.step3.h3': 'You\'re booked!', 'bk.step3.p': 'Confirmation by email. See you soon!',
    'faq.sl': 'FAQ',
    'faq.h2': 'Your questions, our <span class="ac">answers</span>',
    'faq.sd': 'Can\'t find it? <a href="#booking" style="color:var(--teal);font-weight:700">Schedule a call</a>.',
    'faq1.q': 'Which plan fits my needs?', 'faq1.a': '<p>It depends on the regularity of your flow, not your size.</p><ul><li><span class="faq-badge">Dedicated</span><span>Daily, steady flow. Assigned courier, lowest cost per delivery.</span></li><li><span class="faq-badge b-purple">Flex</span><span>Fluctuating volume. You pay per order, no commitment.</span></li><li><span class="faq-badge b-ink">Express</span><span>One-off need. Ordered per run from our site, no account needed.</span></li></ul><p>Unsure? Our simulator gives you a recommendation in 30 seconds.</p>',
    'faq2.q': 'How do my customers place orders?', 'faq2.a': '<p>Through your existing channels. Your customers keep ordering the way they already do: in-store, by phone, on your website, your app, WhatsApp, or via platforms (Uber Eats, Smood, Just Eat…).</p><p>Chaskis does not replace your order tool. We take over once the order is placed, to deliver it. You stay in control of your brand and customer relationship.</p>',
    'faq3.q': 'How do I send you my orders?', 'faq3.a': '<p>Three options depending on your setup.</p><ul><li><span class="faq-badge">API</span><span>Automatic sync of your orders with our dispatch. The most common case.</span></li><li><span class="faq-badge b-purple">Import</span><span>For grouped flows, sent as a file.</span></li><li><span class="faq-badge b-ink">Dashboard</span><span>Manual entry for exceptional orders (phone call, walk-in).</span></li></ul><p>We handle the full technical setup at launch. No coding on your side.</p>',
    'faq4.q': 'What if a courier is sick or unavailable?', 'faq4.a': '<p><strong>Replacement guaranteed.</strong> That\'s our problem, not yours.</p><p>Our couriers are employees, not freelancers. We handle absences in-house. If your dedicated courier is on leave or sick, another one steps in the same day, already trained on your standards.</p><p>Unlike freelance platforms, you never face last-minute cancellations or missing couriers.</p>',
    'faq5.q': 'Damage, loss, disputes: how do you handle them?', 'faq5.a': '<p>Every delivery is tracked and insured.</p><p>At pickup and drop-off, the courier captures a timestamped proof (photo or signature). In case of a dispute, we retrieve the step in question within minutes.</p><p>Deliveries are covered by insurance, with a higher cap for luxury, pharma and legal. Everything is documented in your dashboard.</p>',
    'faq6.q': 'What zones and what types of parcels?', 'faq6.a': '<p><strong>Zones covered:</strong> Geneva, Nyon, Lausanne and the Riviera.</p><ul><li><span class="faq-badge">Courier bag</span><span>Standard format, Uber Eats style. For documents, envelopes, small parcels.</span></li><li><span class="faq-badge b-purple">Car trunk</span><span>For larger deliveries.</span></li></ul><p>We adapt the protocol (temperature, confidentiality, enhanced proof) to your sector: pharma, food, luxury, legal. A non-standard need? Let\'s discuss it on the discovery call.</p>',
    'faq7.q': 'Can I switch plans along the way?', 'faq7.a': '<p>Yes, no friction, between <strong>Flex</strong> and <strong>Dedicated</strong>.</p><p>Starting on Flex and your volume grows? We switch to Dedicated as soon as it pays off for you. Conversely, if activity slows down, we move back to Flex with no penalty.</p><p>Express isn\'t really a plan: it\'s the baseline service, ordered directly from our site, no account. You can use it occasionally alongside any plan.</p>',
    'faq.sd.left': 'Can\'t find what you\'re looking for? Call us or come see us.',
    'foot.tag': 'Delivery, mobility and logistics infrastructure for French-speaking Swiss businesses.',
    'foot.svc.h': 'Services', 'foot.svc.1': 'Order', 'foot.svc.2': 'Dashboard', 'foot.svc.3': 'Our sectors', 'foot.svc.4': 'Schedule a call',
    'foot.co.h': 'Company', 'foot.co.1': 'Join us',
    'foot.leg.h': 'Legal', 'foot.leg.1': 'Legal notice', 'foot.leg.2': 'Privacy', 'foot.leg.3': 'T&C',
    'foot.made': 'Made in Switzerland',
    'float.cta': 'Schedule a call',
  }
};
// Exposé pour que shared.js fusionne ce dict avec T_BASE (getDict) et applique l'i18n en un seul passage.
window.T = T;

// shared.js (__chaskisSetLang) applique déjà l'i18n du DOM et met à jour l'UI de langue.
// Ici on ne fait QUE reconstruire les sections dynamiques (simulateur, calendrier, témoignages) dans la bonne langue.
function setLang(lang) {
  if (window._simUpdate) window._simUpdate();
  if (window._calRebuild) window._calRebuild(lang);
  if (window._testiRebuild) window._testiRebuild(lang);
}

// Lang drop toggle : géré par assets/js/shared.js (window.__chaskisSetLang). Ne pas dupliquer ici.
// Service Worker : enregistré par shared.js (opt-in via l'attribut data-sw sur <html>).

// ===== DELIVERY CANVAS ANIMATION =====
(function() {
  const canvas = document.getElementById('delivery-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    const hero = canvas.parentElement;
    W = canvas.width = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const TEAL = [75, 179, 164];
  const MAX = 1;          // one route at a time
  const SPAWN_F = 90;     // frames the origin dot pulses before tracing (~1.5s)
  const FADE_F  = 60;     // frames to fade out after completion

  let couriers = [];
  let raf;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function makeRoute() {
    let sx, sy, ex, ey, dist, att = 0;
    do {
      // Bias toward edges, avoid central zone on desktop
      const edgeX = () => Math.random() < 0.5 ? rnd(0.04, 0.32) * W : rnd(0.68, 0.96) * W;
      const anyX  = () => rnd(0.04, 0.96) * W;
      const edgeY = () => rnd(0.05, 0.95) * H;
      sx = W > 768 ? edgeX() : anyX(); sy = edgeY();
      ex = W > 768 ? edgeX() : anyX(); ey = edgeY();
      dist = Math.hypot(ex-sx, ey-sy);
      att++;
    } while ((dist < 200 || dist > 540) && att < 40);

    const pts = [{x:sx, y:sy}];
    const r = Math.random();
    if (r < 0.42) {
      pts.push({x:ex, y:sy});                              // horizontal → vertical
    } else if (r < 0.84) {
      pts.push({x:sx, y:ey});                              // vertical → horizontal
    } else {
      const mx = (sx + ex) / 2 + rnd(-40, 40);
      pts.push({x:mx, y:sy}, {x:mx, y:ey});               // Z
    }
    pts.push({x:ex, y:ey});

    let segs = [], total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
      segs.push(l); total += l;
    }

    return {
      pts, segs, total,
      pos: 0,
      speed: rnd(0.8, 1.4),
      phase: 'spawn',         // spawn → trace → fade
      timer: 0,
      alpha: 1
    };
  }

  function getAt(c, d) {
    let rem = Math.min(d, c.total);
    for (let i = 0; i < c.segs.length; i++) {
      if (rem <= c.segs[i]) {
        const t = c.segs[i] > 0 ? rem / c.segs[i] : 0;
        return { x: c.pts[i].x + (c.pts[i+1].x - c.pts[i].x) * t,
                 y: c.pts[i].y + (c.pts[i+1].y - c.pts[i].y) * t };
      }
      rem -= c.segs[i];
    }
    return {...c.pts[c.pts.length - 1]};
  }

  // Draw entire traced portion (0 → c.pos) as dashes at given alpha
  function drawRoute(c, alpha) {
    if (c.pos <= 0) return;
    const [r, g, b] = TEAL;
    const N = Math.ceil(c.pos / 5);
    ctx.beginPath();
    ctx.setLineDash([5, 9]);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.13 * alpha})`;
    for (let i = 0; i <= N; i++) {
      const pt = getAt(c, c.pos * i / N);
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Init: one starts now, one is delayed
  couriers.push(makeRoute());

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const [r, g, b] = TEAL;

    couriers = couriers.filter(c => c.phase !== 'dead');
    while (couriers.length < MAX) couriers.push(makeRoute());

    for (const c of couriers) {
      c.timer++;
      if (c.timer <= 0) continue; // pre-delay: invisible

      if (c.phase === 'spawn') {
        // Pulsing origin dot, visible and prominent
        // Single ring, ease-out cubic, time-based (smooth, no restart jump)
        const t = (performance.now() % 2400) / 2400; // 2.4s period
        const eased = 1 - Math.pow(1 - t, 3);        // ease-out cubic
        // Core dot, small and calm
        ctx.beginPath();
        ctx.arc(c.pts[0].x, c.pts[0].y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
        ctx.fill();
        // Single expanding ring
        ctx.beginPath();
        ctx.arc(c.pts[0].x, c.pts[0].y, 3.5 + eased * 18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - eased) * 0.18})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (c.timer >= SPAWN_F) c.phase = 'trace';

      } else if (c.phase === 'trace') {
        c.pos += c.speed;

        drawRoute(c, 1);

        // Keep origin dot visible, smooth spawn→trace transition
        ctx.beginPath();
        ctx.arc(c.pts[0].x, c.pts[0].y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
        ctx.fill();

        // Moving dot at head
        const cur = getAt(c, c.pos);
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
        ctx.fill();

        // Pulse ring at head
        const pulse = (performance.now() % 1600) / 1600;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 2.5 + pulse * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - pulse) * 0.18})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (c.pos >= c.total) { c.pos = c.total; c.phase = 'fade'; }

      } else if (c.phase === 'fade') {
        c.alpha -= 1 / FADE_F;
        if (c.alpha <= 0) { c.phase = 'dead'; continue; }
        drawRoute(c, c.alpha);
      }
    }

    raf = requestAnimationFrame(frame);
  }

  frame();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else frame();
  });
})();


/* ===== DIFF CARDS : 3D TILT + TEAL GLOW ===== */
(function(){
  if(window.matchMedia('(max-width:1024px)').matches||'ontouchstart' in window) return;
  var cards=document.querySelectorAll('.diff-card');
  if(!cards.length) return;
  var MAX_TILT=7;
  for(var i=0;i<cards.length;i++){
    (function(card){
      card.addEventListener('mouseenter',function(){
        card.style.transition='box-shadow .4s ease, border-color .4s ease';
      });
      card.addEventListener('mousemove',function(e){
        var r=card.getBoundingClientRect();
        var x=(e.clientX-r.left)/r.width;
        var y=(e.clientY-r.top)/r.height;
        var tiltX=(y-.5)*-MAX_TILT;
        var tiltY=(x-.5)*MAX_TILT;
        card.style.transform='perspective(800px) rotateX('+tiltX+'deg) rotateY('+tiltY+'deg) translateY(-6px) scale(1.02)';
        card.style.boxShadow='0 0 0 1px rgba(75,179,164,.4), 0 12px 40px rgba(75,179,164,.25), 0 24px 56px rgba(0,0,0,.45)';
        card.style.setProperty('--mx',(x*100)+'%');
        card.style.setProperty('--my',(y*100)+'%');
      });
      card.addEventListener('mouseleave',function(){
        card.style.transition='transform .5s cubic-bezier(.19,1,.22,1), box-shadow .5s ease, border-color .5s ease';
        card.style.transform='';
        card.style.boxShadow='';
        card.style.setProperty('--mx','50%');
        card.style.setProperty('--my','50%');
      });
    })(cards[i]);
  }
})();

/* ===== OFFRE CARDS : 3D TILT + SPOTLIGHT ===== */
(function(){
  if(window.matchMedia('(max-width:1024px)').matches||'ontouchstart' in window) return;
  var cards=document.querySelectorAll('.offre-card');
  if(!cards.length) return;
  var MAX_TILT=2.5;
  for(var i=0;i<cards.length;i++){
    (function(card){
      card.addEventListener('mouseenter',function(){
        card.style.transition='box-shadow .4s ease, opacity .4s ease';
      });
      card.addEventListener('mousemove',function(e){
        var r=card.getBoundingClientRect();
        var x=(e.clientX-r.left)/r.width;
        var y=(e.clientY-r.top)/r.height;
        var tiltX=(y-.5)*-MAX_TILT;
        var tiltY=(x-.5)*MAX_TILT;
        card.style.transform='perspective(1200px) rotateX('+tiltX+'deg) rotateY('+tiltY+'deg) translateY(-3px) scale(1.005)';
        card.style.boxShadow='0 14px 28px rgba(44,32,82,.07), 0 4px 10px rgba(75,179,164,.05)';
        card.style.setProperty('--mx',(x*100)+'%');
        card.style.setProperty('--my',(y*100)+'%');
      });
      card.addEventListener('mouseleave',function(){
        card.style.transition='transform .5s cubic-bezier(.19,1,.22,1), box-shadow .5s ease, opacity .4s ease';
        card.style.transform='';
        card.style.boxShadow='';
        card.style.setProperty('--mx','50%');
        card.style.setProperty('--my','50%');
      });
    })(cards[i]);
  }
})();

// ===== DELIVERY MAP : Leaflet + Genève (vue GPS) =====
(function initDeliveryMap() {
  const el = document.getElementById('fmDeliveryMap');
  if (!el || !window.L) return;

  // Route OSRM réelle, vélo, rues de Genève (Plainpalais → nord)
  const ROUTE = [
    [46.199004,6.142012],[46.199120,6.141927],[46.199174,6.141872],
    [46.199232,6.141810],[46.199298,6.141767],[46.199465,6.141647],
    [46.199606,6.141547],[46.199665,6.141506],[46.199818,6.141396],
    [46.199927,6.141326],[46.200017,6.141268],[46.200071,6.141233],
    [46.200141,6.141179],[46.200169,6.141277],[46.200519,6.142282],
    [46.200594,6.142502],[46.200728,6.142893],[46.200748,6.142960],
    [46.200775,6.143110],[46.200877,6.143325],[46.200949,6.143432],
    [46.201160,6.143675],[46.201186,6.143704],[46.201239,6.143758],
    [46.201273,6.143792],[46.201382,6.143885],[46.201417,6.143915],
    [46.201489,6.143884],[46.201578,6.143908],[46.201612,6.143917],
    [46.201753,6.143950],[46.201946,6.143992],[46.202028,6.144003],
    [46.202200,6.144018],[46.202290,6.144045],[46.202329,6.144069],
    [46.202358,6.144101],[46.202403,6.144174],[46.202516,6.144414],
    [46.202530,6.144456],[46.202528,6.144489],[46.202501,6.144560],
    [46.202438,6.144683],[46.202264,6.145032],[46.202224,6.145112],
    [46.202028,6.145422],[46.201979,6.145510],[46.201942,6.145589],
    [46.201910,6.145673],[46.201874,6.145778],[46.201849,6.145854],
    [46.201824,6.145914],[46.201715,6.146111],[46.201491,6.146488],
  ];

  // Carte fixe, le zoom sera fait en CSS transform (pas d'appel Leaflet)
  const bounds = L.latLngBounds(ROUTE);
  const center = bounds.getCenter();
  const map = L.map('fmDeliveryMap', {
    center: center,
    zoom: 16,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
    tap: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Attribution masquée (CARTO TOS respecté via mention dans le footer du site)

  // Route prévue en pointillés fins
  L.polyline(ROUTE, {
    color: 'rgba(75,179,164,0.2)',
    weight: 2.5,
    dashArray: '4 6',
    lineCap: 'round',
  }).addTo(map);

  // === Traînée avec dégradé SVG (bleu → teal) ===
  const trail = L.polyline([], {
    color: '#4BB3A4',
    weight: 4,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(map);

  // Glow subtil derrière la tête
  const trailGlow = L.polyline([], {
    color: '#4BB3A4',
    weight: 10,
    opacity: 0.12,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(map);

  // Setup du gradient SVG (bleu #3B82F6 → teal #4BB3A4)
  let gradEl = null;
  function setupGradient() {
    const renderer = map.getRenderer(trail);
    if (!renderer) return;
    const svg = renderer._container;
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg','defs'); svg.insertBefore(defs, svg.firstChild); }
    gradEl = document.createElementNS('http://www.w3.org/2000/svg','linearGradient');
    gradEl.id = 'fmTrailGrad';
    gradEl.setAttribute('gradientUnits','userSpaceOnUse');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg','stop');
    s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#3B82F6'); s1.setAttribute('stop-opacity','0.5');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg','stop');
    s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#4BB3A4'); s2.setAttribute('stop-opacity','0.95');
    gradEl.appendChild(s1); gradEl.appendChild(s2);
    defs.appendChild(gradEl);
  }

  // Pin départ (cercle creux teal)
  L.marker(ROUTE[0], {
    icon: L.divIcon({
      html: '<div class="fm-start-pin"></div>',
      iconSize: [12, 12], iconAnchor: [6, 6], className: '',
    }),
  }).addTo(map);

  // Multi-stop : A au milieu, B à la fin
  const STOP_A_IDX = Math.floor(ROUTE.length / 2);
  const stopAEl = document.createElement('div');
  stopAEl.className = 'fm-stop'; stopAEl.id = 'fmStopA'; stopAEl.textContent = 'A';
  const markerA = L.marker(ROUTE[STOP_A_IDX], {
    icon: L.divIcon({ html: stopAEl.outerHTML, iconSize: [22,22], iconAnchor: [11,11], className: '' }),
  }).addTo(map);

  const stopBEl = document.createElement('div');
  stopBEl.className = 'fm-stop'; stopBEl.id = 'fmStopB'; stopBEl.textContent = 'B';
  const markerB = L.marker(ROUTE[ROUTE.length-1], {
    icon: L.divIcon({ html: stopBEl.outerHTML, iconSize: [22,22], iconAnchor: [11,11], className: '' }),
  }).addTo(map);

  // Icônes coursier
  const BIKE_SVG = '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

  function makeCourierIcon(svg, extra) {
    return L.divIcon({
      html: '<div class="fm-courier-marker' + (extra||'') + '"><div class="fm-courier-pulse"></div><div class="fm-courier-icon">' + svg + '</div></div>',
      iconSize: [34, 34], iconAnchor: [17, 17], className: '',
    });
  }
  const bikeIcon = makeCourierIcon(BIKE_SVG);
  const deliveredIcon = makeCourierIcon(CHECK_SVG, ' delivered');

  const courierMarker = L.marker(ROUTE[0], { icon: bikeIcon, zIndexOffset: 1000 }).addTo(map);

  // Segments
  const segLens = ROUTE.slice(1).map((p, i) =>
    Math.hypot(p[0] - ROUTE[i][0], p[1] - ROUTE[i][1])
  );
  const totalLen = segLens.reduce((s, v) => s + v, 0);

  function getPosAt(t) {
    const dist = t * totalLen;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (acc + segLens[i] >= dist) {
        const f = segLens[i] > 0 ? (dist - acc) / segLens[i] : 0;
        return {
          latlng: [
            ROUTE[i][0] + (ROUTE[i+1][0] - ROUTE[i][0]) * f,
            ROUTE[i][1] + (ROUTE[i+1][1] - ROUTE[i][1]) * f,
          ],
          seg: i,
        };
      }
      acc += segLens[i];
    }
    return { latlng: ROUTE[ROUTE.length - 1], seg: ROUTE.length - 2 };
  }

  // === Références DOM du mockup ===
  const badge = document.getElementById('fmBadge');
  const stepsEl = document.querySelectorAll('#fmSteps .fm-step');
  const CHECK_HTML = '<svg class="fm-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  const CHECK_ANIM_HTML = '<svg class="fm-check anim" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  const DOT_HTML = '<span class="fm-step-dot"></span>';
  const CIRCLE_HTML = '<span class="fm-step-circle"></span>';
  const BADGE_CHECK = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';

  // Textes dynamiques pour les steps A et B
  const STEP_TEXTS_FR = {
    2: { pending: 'Point A : en attente', active: 'Point A : en cours', done: 'Point A livré · <strong>14:18</strong>' },
    3: { pending: 'Point B : en attente', active: 'Point B : en cours', done: 'Point B livré · <strong>14:24</strong>' },
  };
  const STEP_TEXTS_EN = {
    2: { pending: 'Point A: waiting', active: 'Point A: in progress', done: 'Point A delivered · <strong>14:18</strong>' },
    3: { pending: 'Point B: waiting', active: 'Point B: in progress', done: 'Point B delivered · <strong>14:24</strong>' },
  };
  function STEP_TEXTS() { return (window._currentLang === 'en') ? STEP_TEXTS_EN : STEP_TEXTS_FR; }

  function setMockupPhase(phase, aIsDone, bIsDone) {
    stepsEl.forEach((s) => {
      const p = parseInt(s.dataset.phase);
      const wasDone = s.classList.contains('done');
      s.classList.remove('done','active','pending');
      const ic = s.querySelector('.fm-step-ic');
      const txt = s.querySelector('.fm-step-txt');
      // Check animé seulement si le step vient de passer en done
      const chk = (justChanged) => justChanged ? CHECK_ANIM_HTML : CHECK_HTML;

      if (p <= 1) {
        if (p < phase) { s.classList.add('done'); ic.innerHTML = chk(!wasDone); }
        else if (p === phase) { s.classList.add('active'); ic.innerHTML = DOT_HTML; }
        else { s.classList.add('pending'); ic.innerHTML = CIRCLE_HTML; }
      }
      else if (p === 2) {
        if (aIsDone) { s.classList.add('done'); ic.innerHTML = chk(!wasDone); txt.innerHTML = STEP_TEXTS()[2].done; }
        else if (phase >= 2) { s.classList.add('active'); ic.innerHTML = DOT_HTML; txt.innerHTML = STEP_TEXTS()[2].active; }
        else { s.classList.add('pending'); ic.innerHTML = CIRCLE_HTML; txt.innerHTML = STEP_TEXTS()[2].pending; }
      }
      else if (p === 3) {
        if (bIsDone) { s.classList.add('done'); ic.innerHTML = chk(!wasDone); txt.innerHTML = STEP_TEXTS()[3].done; }
        else if (aIsDone) { s.classList.add('active'); ic.innerHTML = DOT_HTML; txt.innerHTML = STEP_TEXTS()[3].active; }
        else { s.classList.add('pending'); ic.innerHTML = CIRCLE_HTML; txt.innerHTML = STEP_TEXTS()[3].pending; }
      }
    });
    const isEn = window._currentLang === 'en';
    if (phase <= 1) {
      badge.className = 'fm-badge waiting';
      badge.innerHTML = phase === 0 ? (isEn ? 'Waiting' : 'En attente') : (isEn ? 'Assigned' : 'Assigné');
    } else if (!bIsDone) {
      badge.className = 'fm-badge in-progress'; badge.innerHTML = isEn ? 'In progress' : 'En cours';
    } else {
      badge.className = 'fm-badge delivered'; badge.innerHTML = BADGE_CHECK + (isEn ? ' Delivered' : ' Livrée');
    }
  }

  const CYCLE = 7000;
  const PAUSE = 2500;
  let startTs = null;
  let rafId = null;
  let lastPhase = -1;
  let lastAState = false;
  let lastBState = false;
  let aMarked = false;
  let bMarked = false;
  let hasZoomed = false;
  const mapEl = map.getContainer();

  function updateStopMarker(marker, done) {
    const el = marker.getElement();
    if (!el) return;
    const stop = el.querySelector('.fm-stop');
    if (stop) stop.className = done ? 'fm-stop done' : 'fm-stop';
  }

  function animate(ts) {
    if (!startTs) startTs = ts;
    const elapsed = ts - startTs;

    if (elapsed >= CYCLE + PAUSE) {
      startTs = ts;
      lastPhase = 1; // reset à 1 pour forcer setMockupPhase(2) au premier frame
      lastAState = false; lastBState = false;
      aMarked = false; bMarked = false; hasZoomed = false;
      // Reset sans transition visible (désactiver transition, reset, réactiver)
      el.style.transition = 'none';
      el.style.transform = 'scale(1)';
      // Force reflow pour appliquer immédiatement
      void el.offsetHeight;
      el.style.transition = 'transform 2.5s ease-out';
      trail.setLatLngs([]); trailGlow.setLatLngs([]);
      courierMarker.setLatLng(ROUTE[0]);
      courierMarker.setIcon(bikeIcon);
      markerA.setIcon(L.divIcon({ html:'<div class="fm-stop">A</div>', iconSize:[22,22], iconAnchor:[11,11], className:'' }));
      markerB.setIcon(L.divIcon({ html:'<div class="fm-stop">B</div>', iconSize:[22,22], iconAnchor:[11,11], className:'' }));
      if (!map.hasLayer(markerB)) map.addLayer(markerB);
      // zoom reset via map.setZoom ci-dessus
      setMockupPhase(2, false, false);
      rafId = requestAnimationFrame(animate);
      return;
    }

    const t = Math.min(elapsed / CYCLE, 1);
    // Two-phase easing: decelerate→pause at A (0.52), then accelerate→decelerate to B
    let eased;
    const STOP_A = 0.56; // computed: point A is at 55.96% of total route distance
    if (t < 0.50) {
      const p = t / 0.50;
      eased = STOP_A * (1 - Math.pow(1 - p, 3));
    } else if (t < 0.60) {
      eased = STOP_A;
    } else {
      const p = (t - 0.60) / (1 - 0.60);
      const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2) / 2;
      eased = STOP_A + (1 - STOP_A) * e;
    }
    const { latlng, seg } = getPosAt(eased);

    courierMarker.setLatLng(latlng);

    // Traînée gradient
    const pts = ROUTE.slice(0, seg + 1).concat([latlng]);
    trail.setLatLngs(pts);

    // Glow comète (derniers ~6 points)
    const glowStart = Math.max(0, seg - 5);
    trailGlow.setLatLngs(ROUTE.slice(glowStart, seg + 1).concat([latlng]));

    // Appliquer le gradient SVG sur le path
    if (!gradEl) setupGradient();
    if (gradEl) {
      const sp = map.latLngToLayerPoint(ROUTE[0]);
      const ep = map.latLngToLayerPoint(latlng);
      gradEl.setAttribute('x1', sp.x); gradEl.setAttribute('y1', sp.y);
      gradEl.setAttribute('x2', ep.x); gradEl.setAttribute('y2', ep.y);
      const pathEl = trail.getElement();
      if (pathEl) pathEl.setAttribute('stroke', 'url(#fmTrailGrad)');
    }

    // Zoom + travelling CSS (transition gérée par CSS, pas JS chaque frame)
    if (!hasZoomed && t > 0.15) {
      hasZoomed = true;
      el.style.transform = 'scale(1.15)';
      // transform-origin biaise vers le point B (set dynamiquement)
      const destPx = map.latLngToContainerPoint(ROUTE[ROUTE.length - 1]);
      const w = el.offsetWidth, h = el.offsetHeight;
      if (w && h) el.style.transformOrigin = `${(destPx.x/w)*100}% ${(destPx.y/h)*100}%`;
    }

    // Stop A livré (~50% du tracé)
    if (!aMarked && eased >= 0.56) {
      aMarked = true;
      updateStopMarker(markerA, true);
    }

    // Stop B livré, seulement quand le coursier est vraiment arrivé
    if (!bMarked && eased >= 0.99) {
      bMarked = true;
      courierMarker.setIcon(deliveredIcon);
      if (map.hasLayer(markerB)) map.removeLayer(markerB);
    }

    // Phases mockup, MAJ seulement quand ça change (sinon l'animation check redémarre)
    // Étapes 0 et 1 (Commande reçue, Coursier assigné) déjà cochées dès le début
    let phase;
    if (t < 0.50) phase = 2;
    else phase = 3;
    if (phase !== lastPhase || aMarked !== lastAState || bMarked !== lastBState) {
      lastPhase = phase; lastAState = aMarked; lastBState = bMarked;
      setMockupPhase(phase, aMarked, bMarked);
    }

    rafId = requestAnimationFrame(animate);
  }

  map.whenReady(() => {
    setMockupPhase(2, false, false);
    mapEl.style.transform = 'scale(1)';
    setTimeout(() => { rafId = requestAnimationFrame(animate); }, 600);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      startTs = null;
      rafId = requestAnimationFrame(animate);
    }
  });
})();

// ===== TESTIMONIALS : adaptive infinite marquee =====
(function() {
  const CARDS_FR = [
    { text: "On est passé de 30% de commission à un tarif fixe. En 3 mois, la marge est récupérée sur chaque commande.", name: "Marie Laurent", role: "Pharmacie du Lac, Genève", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
    { text: "L'import CSV a tout changé. On envoie nos 40 commandes du matin en un clic, les livreurs reçoivent tout automatiquement.", name: "Pierre Dupont", role: "Swiss E-Shop, Neuchâtel", photo: "https://randomuser.me/api/portraits/men/32.jpg" },
    { text: "Le livreur connaît notre protocole discrétion. Pour la bijouterie, c'est crucial. Et la preuve de remise en photo est irréprochable.", name: "Sophie Berthier", role: "Maison Bulgari, Genève", photo: "https://randomuser.me/api/portraits/women/68.jpg" },
    { text: "Notaire, on a des délais légaux stricts. Chaskis livre nos actes à temps, avec preuve électronique. Zéro litige depuis 6 mois.", name: "François Riviera", role: "Étude Notariale Riviera, Lausanne", photo: "https://randomuser.me/api/portraits/men/75.jpg" },
    { text: "Pour nos prélèvements du matin, la fenêtre est serrée. En 6 mois, pas un seul retard. Ça change la donne pour nos patients.", name: "Dr. Caroline Weber", role: "Laboratoire Genolier, Nyon", photo: "https://randomuser.me/api/portraits/women/52.jpg" },
    { text: "L'interface de suivi en temps réel a remplacé nos trois outils maison. Nos clients adorent recevoir le SMS de livraison.", name: "Thomas Meier", role: "Atelier Horloger, La Chaux-de-Fonds", photo: "https://randomuser.me/api/portraits/men/45.jpg" },
  ];
  const CARDS_EN = [
    { text: "We switched from 30% commission to a fixed rate. Within 3 months, the margin was recovered on every single order.", name: "Marie Laurent", role: "Pharmacie du Lac, Geneva", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
    { text: "The CSV import changed everything. We send our 40 morning orders in one click, and couriers receive everything automatically.", name: "Pierre Dupont", role: "Swiss E-Shop, Neuchâtel", photo: "https://randomuser.me/api/portraits/men/32.jpg" },
    { text: "The courier knows our discretion protocol. For a jeweller, that's critical. And the photo proof of delivery is impeccable.", name: "Sophie Berthier", role: "Maison Bulgari, Geneva", photo: "https://randomuser.me/api/portraits/women/68.jpg" },
    { text: "As a notary, we have strict legal deadlines. Chaskis delivers our deeds on time, with electronic proof. Zero disputes in 6 months.", name: "François Riviera", role: "Étude Notariale Riviera, Lausanne", photo: "https://randomuser.me/api/portraits/men/75.jpg" },
    { text: "For our morning samples, the window is tight. In 6 months, not a single delay. It's a game-changer for our patients.", name: "Dr. Caroline Weber", role: "Laboratoire Genolier, Nyon", photo: "https://randomuser.me/api/portraits/women/52.jpg" },
    { text: "The real-time tracking interface replaced our three in-house tools. Our clients love getting the delivery SMS.", name: "Thomas Meier", role: "Atelier Horloger, La Chaux-de-Fonds", photo: "https://randomuser.me/api/portraits/men/45.jpg" },
  ];
  let testiLang = 'fr';
  // Avis pilotables depuis le back-office (source unique). Repli sur les avis par défaut.
  try { window.CHASKIS_TESTI_DEFAULT = CARDS_FR; } catch(e){}
  function getCards() { if (window.CHASKIS_TESTI && window.CHASKIS_TESTI.length) return window.CHASKIS_TESTI; return testiLang === 'en' ? CARDS_EN : CARDS_FR; }
  const STAR_PT = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>';
  function starsHTML(n) { n = (n==null ? 5 : Math.max(0, Math.min(5, n))); var s=''; for (var i=0;i<5;i++){ s += '<svg viewBox="0 0 24 24"' + (i<n ? '' : ' style="opacity:.22"') + '>' + STAR_PT + '</svg>'; } return '<div class="tc-stars">' + s + '</div>'; }

  function makeCard(c) {
    return '<article class="tc">' + starsHTML(c.rating) +
      '<p class="tc-text">' + c.text + '</p>' +
      '<div class="tc-author"><img class="tc-av" src="' + c.photo + '" alt="' + c.name + '" loading="lazy">' +
      '<div class="tc-info"><h4>' + c.name + '</h4><p>' + c.role + '</p></div></div></article>';
  }

  const track = document.getElementById('testiSet0');
  if (!track) return;

  const GAP = 20;              // must match CSS gap
  const CARD_W = 340;          // must match .tc flex-basis
  const CARD_STEP = CARD_W + GAP;
  // One "unit" = CARDS.length cards. The track shifts by exactly one unit per cycle.
  // Because the content is periodic with this unit, the reset is mathematically seamless.
  let UNIT_STEP = getCards().length * CARD_STEP;   // recalculé à chaque build (le nombre d'avis peut changer)
  const SPEED = 60;            // px per second
  let styleEl = null;

  function build() {
    UNIT_STEP = getCards().length * CARD_STEP;
    const vw = window.innerWidth;
    // Track must be >= viewport + UNIT_STEP so during the entire cycle the viewport is covered.
    const unitsNeeded = Math.ceil((vw + UNIT_STEP) / UNIT_STEP) + 1; // +1 safety buffer
    const cards = getCards();
    const html = Array.from({length: unitsNeeded}, () => cards.map(makeCard).join('')).join('');
    track.innerHTML = html;
    const duration = Math.max(20, Math.round(UNIT_STEP / SPEED));

    // Single element, single animation, explicit pixel travel = zero drift, zero ambiguity.
    if (!styleEl) { styleEl = document.createElement('style'); document.head.appendChild(styleEl); }
    styleEl.textContent =
      '@keyframes testi-scroll-dyn{from{transform:translate3d(0,0,0)}to{transform:translate3d(-' + UNIT_STEP + 'px,0,0)}}' +
      '#testiSet0{animation:testi-scroll-dyn ' + duration + 's linear infinite}';
  }

  build();

  // Rebuild on resize (debounced) so track always covers viewport.
  let rzT;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(build, 200);
  });

  window._testiRebuild = function(lang) { testiLang = lang; build(); };
})();

// ===== BOOKING TESTIMONIAL CAROUSEL =====
(function(){
  var slides = document.querySelectorAll('#bkTestiSlides .bk-testi-slide');
  var dots = document.querySelectorAll('#bkTestiDots .bk-testi-dot');
  var prev = document.getElementById('bkTestiPrev');
  var next = document.getElementById('bkTestiNext');
  if(!slides.length) return;
  var cur = 0;
  var autoTimer;

  function show(i){
    cur = (i + slides.length) % slides.length;
    slides.forEach(function(s,k){ s.classList.toggle('active', k===cur); });
    dots.forEach(function(d,k){ d.classList.toggle('active', k===cur); });
  }
  function go(delta){ show(cur + delta); resetAuto(); }
  function resetAuto(){
    clearInterval(autoTimer);
    autoTimer = setInterval(function(){ show(cur + 1); }, 6000);
  }
  prev && prev.addEventListener('click', function(){ go(-1); });
  next && next.addEventListener('click', function(){ go(1); });
  dots.forEach(function(d){
    d.addEventListener('click', function(){ show(parseInt(d.dataset.i,10)); resetAuto(); });
  });
  resetAuto();
  // Pause on hover
  var wrap = document.getElementById('bkTesti');
  if(wrap){
    wrap.addEventListener('mouseenter', function(){ clearInterval(autoTimer); });
    wrap.addEventListener('mouseleave', resetAuto);
  }
})();

// ===== PROMO BAR dismiss =====
(function(){
  var btn = document.getElementById('promoBarClose');
  if(!btn) return;
  btn.addEventListener('click', function(){
    document.body.classList.remove('has-promo');
    try { localStorage.setItem('promoDismissed','1'); } catch(e){}
  });
})();

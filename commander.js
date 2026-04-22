/* ===== COMMANDER.JS =====
 * Formulaire 2-etapes : course (commanditaire + collecte + livraisons collapsibles + vehicule/planning + options) + paiement.
 * Autocomplete geo.admin.ch, zone badges Z1-Z4, stops collapsibles avec Valider, FLIP drag, suggestion d'optimisation d'ordre.
 */

(function(){
'use strict';

const P = window.ChaskisPricing;
if (!P) { console.error('ChaskisPricing not loaded'); return; }

const MAX_STOPS = 5;
const DRAFT_KEY = 'chaskis_commander_draft_v2';

// ===== STATE =====
const state = {
  step: 1,
  contact: { name: '', email: '', phone: '', company: '' },
  supplements: { additionalCourier: false },
  promo: { code: '', applied: null },
  pickup: {
    addr: '', label: '', coords: null, postalCode: null,
    first: '', last: '', society: '',
    collapsed: false, validated: false,
  },
  stops: [],
  vehicle: 'bike',
  timing: 'scheduled',  // 'express' (super express, meme jour <2h) | 'scheduled' (demain 9h+)
  scheduledDate: null,
  scheduledTime: null,
  note: '',
  file: null,
  pricing: null,
  pricingLoading: false,
  pricingError: null,
  optim: null,
  optimDismissed: false,
};

function makeStop() {
  return {
    id: 's_' + Math.random().toString(36).slice(2, 9),
    addr: '', label: '', coords: null, postalCode: null,
    first: '', last: '', phone: '', society: '', note: '',
    collapsed: false, validated: false,
  };
}
state.stops.push(makeStop());

// ===== DRAFT =====
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...state, ts: Date.now() })); } catch(e){}
}
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return;
    const d = JSON.parse(raw);
    if (!d.ts || Date.now() - d.ts > 24*3600*1000) { localStorage.removeItem(DRAFT_KEY); return; }
    ['contact','pickup','vehicle','timing','scheduledDate','scheduledTime','urgent','fragile','note'].forEach(k => { if (d[k] !== undefined) state[k] = d[k]; });
    if (Array.isArray(d.stops) && d.stops.length) state.stops = d.stops.map(s => Object.assign(makeStop(), s));
  } catch(e){ try { localStorage.removeItem(DRAFT_KEY); } catch(_){} }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch(e){} }

// ===== HELPERS =====
function debounce(fn, ms) { let t; return function(...a){ clearTimeout(t); t = setTimeout(() => fn.apply(this,a), ms); }; }
function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatCHF(n) { return new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'').trim()); }
function isPhone(s) { return String(s||'').replace(/[^\d+]/g, '').length >= 9; }

// ===== ZONE BADGE (nom humain seul, pas de prefixe Z1) =====
function zoneBadgeHtml(zone, ok) {
  if (!zone) return '';
  const cls = ok ? `z${zone.id}` : 'warn';
  const label = ok ? zone.shortLabel : 'Livraison seulement';
  return `<span class="zbadge ${cls}"><span class="zd"></span>${escapeHtml(label)}</span>`;
}
function zoneOutBadgeHtml() {
  return `<span class="zbadge danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Hors zone</span>`;
}

// ===== AUTOCOMPLETE =====
function attachAutocomplete(rootEl, inputEl, onSelect) {
  const wrap = inputEl.closest('.ac-inp-wrap');
  const dd = rootEl.querySelector('.ac-dd');
  let activeIdx = -1;
  let currentItems = [];

  const search = debounce(async (q) => {
    if (q.trim().length < 3) { dd.classList.remove('show'); dd.innerHTML=''; wrap.classList.remove('loading'); return; }
    wrap.classList.add('loading');
    const results = await P.searchAddresses(q);
    wrap.classList.remove('loading');
    currentItems = results;
    if (!results.length) { dd.classList.remove('show'); return; }
    dd.innerHTML = results.map((r, i) => `
      <div class="ac-item${i===activeIdx?' active':''}" data-idx="${i}">
        <svg class="ac-item-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <div class="ac-item-txt">${escapeHtml(r.label)}</div>
      </div>
    `).join('');
    dd.classList.add('show');
  }, 280);

  inputEl.addEventListener('input', e => { activeIdx = -1; search(e.target.value); });
  inputEl.addEventListener('focus', () => { if (currentItems.length && inputEl.value.length >= 3) dd.classList.add('show'); });
  inputEl.addEventListener('keydown', e => {
    if (!dd.classList.contains('show')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx+1, currentItems.length-1); updateActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx-1, 0); updateActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0 && currentItems[activeIdx]) pick(activeIdx); }
    else if (e.key === 'Escape') { dd.classList.remove('show'); }
  });
  function updateActive() {
    dd.querySelectorAll('.ac-item').forEach((el, i) => el.classList.toggle('active', i === activeIdx));
  }
  function pick(i) {
    const r = currentItems[i]; if (!r) return;
    inputEl.value = r.label;
    dd.classList.remove('show');
    onSelect(r);
  }
  dd.addEventListener('click', e => {
    const item = e.target.closest('.ac-item'); if (!item) return;
    pick(parseInt(item.dataset.idx, 10));
  });
  document.addEventListener('click', e => { if (!rootEl.contains(e.target)) dd.classList.remove('show'); });
}

// ===== CONTACT (commanditaire) — step 3 =====
(function initContact(){
  const map = { contactName: 'name', contactEmail: 'email', contactPhone: 'phone', contactCompany: 'company' };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.contact[key] || '';
    el.addEventListener('input', e => {
      state.contact[key] = e.target.value;
      saveDraft();
      onAnyChange();
    });
  });
})();

// ===== PICKUP =====
(function initPickup(){
  const root = document.getElementById('acPickup');
  const input = document.getElementById('pickupAddr');
  input.value = state.pickup.addr || '';

  attachAutocomplete(root, input, (r) => {
    state.pickup.addr = r.label;
    state.pickup.label = r.label;
    state.pickup.coords = r.coordinates;
    state.pickup.postalCode = r.postalCode;
    updatePickupCoverage();
    saveDraft(); onAnyChange();
  });
  input.addEventListener('input', e => {
    state.pickup.addr = e.target.value;
    if (state.pickup.label !== e.target.value) { state.pickup.coords = null; state.pickup.postalCode = null; state.pickup.label = ''; }
    updatePickupCoverage();
    saveDraft(); onAnyChange();
  });
  function updatePickupCoverage() {
    const msg = document.getElementById('pickupCov');        // message en dessous
    const badge = document.getElementById('pickupCovBadge'); // badge en haut a droite du label
    const slot = document.getElementById('pickupZoneSlot');  // badge dans le header de bloc
    msg.classList.remove('show','warn','danger'); msg.innerHTML = '';
    badge.innerHTML = '';
    slot.innerHTML = '';
    input.classList.remove('err');
    if (!state.pickup.coords) return;
    const check = P.canPickupAt(state.pickup.postalCode);
    if (check.ok) {
      badge.innerHTML = zoneBadgeHtml(check.zone, true);
      slot.innerHTML = zoneBadgeHtml(check.zone, true);
    } else if (check.reason === 'delivery_only') {
      badge.innerHTML = `<span class="zbadge warn"><span class="zd"></span>Livraison seulement</span>`;
      msg.innerHTML = `<strong>Nous livrons à cette adresse, mais nous n'y collectons pas.</strong>Merci de choisir une adresse de collecte dans l'une de nos zones principales (${check.zone ? check.zone.shortLabel : 'Genève, Lausanne, Nyon, Riviera'}).`;
      msg.classList.add('show','warn');
      input.classList.add('err');
    } else {
      badge.innerHTML = `<span class="zbadge danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Hors zone</span>`;
      msg.innerHTML = `<strong>Désolé, cette adresse n'est pas desservie pour le moment.</strong>Nous couvrons Genève, Lausanne, Nyon et la Riviera.`;
      msg.classList.add('show','danger');
      input.classList.add('err');
    }
  }
  ['pickupFirst','pickupLast','pickupSociety'].forEach(id => {
    const el = document.getElementById(id);
    const map = { pickupFirst: 'first', pickupLast: 'last', pickupSociety: 'society' };
    const key = map[id];
    el.value = state.pickup[key] || '';
    el.addEventListener('input', e => { state.pickup[key] = e.target.value; saveDraft(); onAnyChange(); });
  });
  window._updatePickupCoverage = updatePickupCoverage;
})();

// ===== STOPS =====
const stopsList = document.getElementById('stopsList');
const addStopBtn = document.getElementById('addStopBtn');

function stopValid(s) {
  return !!(s.coords && P.canDeliverAt(s.postalCode).ok && s.first.trim() && s.last.trim());
}

function stopZoneHtml(s) {
  if (!s.coords) return '';
  const check = P.canDeliverAt(s.postalCode);
  if (check.ok) return zoneBadgeHtml(check.zone, true);
  return zoneOutBadgeHtml();
}

function captureRects() {
  const map = new Map();
  stopsList.querySelectorAll('.stop-card').forEach(c => {
    map.set(c.dataset.stopId, c.getBoundingClientRect());
  });
  return map;
}
function flipAnimate(prevRects) {
  const cards = stopsList.querySelectorAll('.stop-card');
  cards.forEach(c => {
    const prev = prevRects.get(c.dataset.stopId);
    if (!prev) return;
    const next = c.getBoundingClientRect();
    const dy = prev.top - next.top;
    if (Math.abs(dy) < 2) return;
    c.style.transition = 'none';
    c.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Spring feel = admin Framer Motion stiffness 400 damping 30
        c.style.transition = 'transform .42s cubic-bezier(.22,1.35,.36,1)';
        c.style.transform = '';
        setTimeout(() => { c.style.transition = ''; }, 440);
      });
    });
  });
}

function renderStops() {
  const html = state.stops.map((s, i) => {
    const idxLabel = state.stops.length > 1 ? `#${i+1}` : '';
    const expanded = !s.collapsed;
    const zoneBadge = stopZoneHtml(s);
    const nameText = (s.first || s.last) ? `${escapeHtml(s.first)} ${escapeHtml(s.last)}`.trim() : `À remplir`;
    const nameCls = (s.first || s.last) ? '' : 'empty';
    const societyBadge = s.society ? `<span class="stop-society">${escapeHtml(s.society)}</span>` : '';
    const addrLine = s.label ? escapeHtml(s.label) : '';

    return `
      <div class="stop-card ${expanded?'expanded':''}" data-stop-id="${s.id}" data-idx="${i}" draggable="true">
        <div class="stop-hd" data-toggle-id="${s.id}">
          <span class="stop-drag" title="Glisser pour réordonner" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg></span>
          <span class="stop-num">${i+1}</span>
          <div class="stop-info">
            <div class="stop-info-line">
              <span class="stop-name ${nameCls}">${nameText}</span>
              ${societyBadge}
              ${zoneBadge}
            </div>
            ${addrLine ? `<span class="stop-addr">${addrLine}</span>` : `<span class="stop-addr" style="color:#C8C4D0">Livraison ${idxLabel}</span>`}
          </div>
          <div class="stop-actions">
            ${state.stops.length > 1 ? `<button type="button" class="stop-action delete" data-remove="${s.id}" aria-label="Supprimer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
            <button type="button" class="stop-action stop-chevron" aria-label="Déplier"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></button>
          </div>
        </div>
        <div class="stop-body">
          <div class="cf ac" data-stop-ac="${s.id}">
            <label class="cf-lbl">Adresse de livraison <span class="req">*</span></label>
            <div class="ac-inp-wrap">
              <svg class="ac-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <input type="text" class="cf-inp stop-addr-inp" placeholder="Rue, numéro, NPA, ville" autocomplete="off" value="${escapeHtml(s.addr)}">
              <div class="ac-spin"></div>
            </div>
            <div class="ac-dd"></div>
            <div class="cf-cov stop-cov" style="display:none"></div>
          </div>
          <div class="cf-row">
            <div class="cf">
              <label class="cf-lbl">Prénom destinataire <span class="req">*</span></label>
              <input type="text" class="cf-inp stop-first" placeholder="Prénom" value="${escapeHtml(s.first)}">
            </div>
            <div class="cf">
              <label class="cf-lbl">Nom destinataire <span class="req">*</span></label>
              <input type="text" class="cf-inp stop-last" placeholder="Nom" value="${escapeHtml(s.last)}">
            </div>
          </div>
          <div class="cf-row">
            <div class="cf">
              <label class="cf-lbl">Téléphone <span class="opt">recommandé</span></label>
              <input type="tel" class="cf-inp stop-phone" placeholder="+41 79 ..." value="${escapeHtml(s.phone)}">
            </div>
            <div class="cf">
              <label class="cf-lbl">Société / lieu <span class="opt">optionnel</span></label>
              <input type="text" class="cf-inp stop-society" placeholder="Boutique, bureau..." value="${escapeHtml(s.society)}">
            </div>
          </div>
          <div class="cf">
            <label class="cf-lbl">Note <span class="opt">optionnel</span></label>
            <input type="text" class="cf-inp stop-note-inp" placeholder="Code porte, étage..." value="${escapeHtml(s.note)}">
          </div>
          <button type="button" class="stop-validate" data-validate="${s.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Valider cette livraison
          </button>
        </div>
      </div>
    `;
  }).join('');
  stopsList.innerHTML = html;

  state.stops.forEach((s) => {
    const card = stopsList.querySelector(`[data-stop-id="${s.id}"]`);
    if (!card) return;
    attachStopHandlers(card, s);
  });

  // Stops count + add button
  const slot = document.getElementById('stopsCountSlot');
  slot.textContent = `${state.stops.length} / ${MAX_STOPS}`;
  addStopBtn.disabled = state.stops.length >= MAX_STOPS;
  addStopBtn.innerHTML = state.stops.length >= MAX_STOPS
    ? `Maximum ${MAX_STOPS} livraisons atteint`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter une livraison`;
}

function attachStopHandlers(card, s) {
  // Expand/collapse toggle (click on header except delete button)
  card.querySelector('.stop-hd').addEventListener('click', (e) => {
    if (e.target.closest('.stop-action.delete') || e.target.closest('.stop-drag')) return;
    s.collapsed = !s.collapsed;
    card.classList.toggle('expanded', !s.collapsed);
    saveDraft();
  });

  // Delete
  const del = card.querySelector('[data-remove]');
  if (del) del.addEventListener('click', (e) => {
    e.stopPropagation();
    state.stops = state.stops.filter(x => x.id !== s.id);
    renderStops();
    saveDraft(); onAnyChange();
  });

  // Address autocomplete
  const acRoot = card.querySelector('.ac');
  const addrInput = card.querySelector('.stop-addr-inp');
  const covEl = card.querySelector('.stop-cov');

  function updateCov() {
    if (!s.coords) { covEl.style.display = 'none'; addrInput.classList.remove('err'); return; }
    const check = P.canDeliverAt(s.postalCode);
    covEl.style.display = 'flex';
    covEl.innerHTML = check.ok ? zoneBadgeHtml(check.zone, true) : zoneOutBadgeHtml();
    addrInput.classList.toggle('err', !check.ok);
  }

  attachAutocomplete(acRoot, addrInput, (r) => {
    s.addr = r.label; s.label = r.label; s.coords = r.coordinates; s.postalCode = r.postalCode;
    updateCov(); renderStops(); saveDraft(); onAnyChange();
  });
  addrInput.addEventListener('input', e => {
    s.addr = e.target.value;
    if (s.label !== e.target.value) { s.coords = null; s.postalCode = null; s.label = ''; }
    updateCov(); saveDraft(); onAnyChange();
  });
  card.querySelector('.stop-first').addEventListener('input', e => { s.first = e.target.value; saveDraft(); onAnyChange(); });
  card.querySelector('.stop-last').addEventListener('input', e => { s.last = e.target.value; saveDraft(); onAnyChange(); });
  card.querySelector('.stop-phone').addEventListener('input', e => { s.phone = e.target.value; saveDraft(); });
  card.querySelector('.stop-society').addEventListener('input', e => { s.society = e.target.value; saveDraft(); onAnyChange(); });
  card.querySelector('.stop-note-inp').addEventListener('input', e => { s.note = e.target.value; saveDraft(); });
  updateCov();

  // Valider -> collapse
  const validateBtn = card.querySelector('[data-validate]');
  validateBtn.addEventListener('click', () => {
    if (!stopValid(s)) {
      // Show errors on missing fields
      ['.stop-first','.stop-last'].forEach(sel => {
        const inp = card.querySelector(sel);
        if (!inp.value.trim()) inp.classList.add('err'); else inp.classList.remove('err');
      });
      if (!s.coords || !P.canDeliverAt(s.postalCode).ok) addrInput.classList.add('err');
      return;
    }
    s.validated = true;
    s.collapsed = true;
    renderStops();
    saveDraft(); onAnyChange();
    // Auto-scroll to next stop or add button
    setTimeout(() => {
      const nextBtn = document.getElementById('addStopBtn');
      if (nextBtn) nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  });

  // Drag & drop avec FLIP
  card.addEventListener('dragstart', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { e.preventDefault(); return; }
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', s.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    stopsList.querySelectorAll('.stop-card.drag-over-target').forEach(c => c.classList.remove('drag-over-target'));
  });
  card.addEventListener('dragover', e => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (!card.classList.contains('dragging')) card.classList.add('drag-over-target');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over-target'));
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over-target');
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === s.id) return;
    const from = state.stops.findIndex(x => x.id === draggedId);
    const to = state.stops.findIndex(x => x.id === s.id);
    if (from === -1 || to === -1) return;
    const prev = captureRects();
    const [moved] = state.stops.splice(from, 1);
    state.stops.splice(to, 0, moved);
    renderStops();
    flipAnimate(prev);
    saveDraft(); onAnyChange();
  });
}

addStopBtn.addEventListener('click', () => {
  if (state.stops.length >= MAX_STOPS) return;
  // Collapse les stops valides pour garder l'écran compact
  state.stops.forEach(s => { if (stopValid(s)) { s.collapsed = true; s.validated = true; } });
  const newStop = makeStop();
  state.stops.push(newStop);
  renderStops();
  saveDraft(); onAnyChange();
  setTimeout(() => {
    const last = stopsList.querySelector(`[data-stop-id="${newStop.id}"]`);
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
});

// ===== VEHICLE / TIMING / OPTIONS =====
document.querySelectorAll('#vehicleCards .opt-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#vehicleCards .opt-card').forEach(c => c.classList.toggle('selected', c === card));
    state.vehicle = card.dataset.vehicle;
    saveDraft(); onAnyChange();
  });
});
function isExpressAvailable() {
  // Super Express : disponible uniquement avant 21h
  return new Date().getHours() < 21;
}
function applyTiming() {
  document.querySelectorAll('#timingSeg .timing-opt').forEach(b => b.classList.toggle('selected', b.dataset.timing === state.timing));
  document.getElementById('timingAsap').style.display = state.timing === 'express' ? '' : 'none';
  document.getElementById('timingScheduled').style.display = state.timing === 'scheduled' ? '' : 'none';
  // Express disponible ?
  const expressBtn = document.querySelector('#timingSeg [data-timing="express"]');
  const available = isExpressAvailable();
  expressBtn.style.opacity = available ? '' : '.5';
  expressBtn.style.pointerEvents = available ? '' : 'none';
  const note = document.getElementById('expressNote');
  const unav = document.getElementById('expressUnavailable');
  if (note) note.style.display = available ? '' : 'none';
  if (unav) unav.style.display = available ? 'none' : 'flex';
}
document.querySelectorAll('#timingSeg .timing-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.timing;
    if (t === 'express' && !isExpressAvailable()) return;
    state.timing = t;
    applyTiming();
    saveDraft(); onAnyChange();
  });
});
applyTiming();

// ===== DATE PICKER =====
(function initDatePicker(){
  const trig = document.getElementById('dtpDateTrig');
  const pop = document.getElementById('dtpDatePop');
  const val = trig.querySelector('.dtp-val');
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DOWS = ['L','M','M','J','V','S','D'];

  function render() {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const today = new Date(); today.setHours(0,0,0,0);
    let html = `<div class="dtp-cal-head">
      <button type="button" class="dtp-cal-btn" data-prev="1" aria-label="Mois précédent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <div class="dtp-cal-title">${MONTHS_FR[viewMonth]} ${viewYear}</div>
      <button type="button" class="dtp-cal-btn" data-next="1" aria-label="Mois suivant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div><div class="dtp-cal-grid">`;
    DOWS.forEach(d => html += `<div class="dtp-cal-dow">${d}</div>`);
    for (let i = 0; i < startOffset; i++) html += `<div></div>`;
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const past = date < today;
      const isToday = date.getTime() === today.getTime();
      const selected = state.scheduledDate === iso;
      html += `<button type="button" class="dtp-cal-day${isToday?' today':''}${selected?' selected':''}" data-date="${iso}"${past?' disabled':''}>${d}</button>`;
    }
    html += `</div>`;
    pop.innerHTML = html;
    pop.querySelector('[data-prev]').addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); });
    pop.querySelector('[data-next]').addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); });
    pop.querySelectorAll('.dtp-cal-day').forEach(b => {
      b.addEventListener('click', () => {
        state.scheduledDate = b.dataset.date;
        const [y,m,d] = b.dataset.date.split('-');
        val.textContent = `${d}/${m}/${y}`;
        trig.classList.remove('empty');
        pop.classList.remove('show'); trig.classList.remove('active');
        saveDraft(); onAnyChange();
      });
    });
  }

  trig.addEventListener('click', e => {
    e.stopPropagation();
    const open = pop.classList.contains('show');
    document.querySelectorAll('.dtp-pop.show').forEach(p => p.classList.remove('show'));
    document.querySelectorAll('.dtp-trig.active').forEach(t => t.classList.remove('active'));
    if (!open) { render(); pop.classList.add('show'); trig.classList.add('active'); }
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('dtpDate').contains(e.target)) { pop.classList.remove('show'); trig.classList.remove('active'); }
  });
})();

// ===== TIME PICKER =====
(function initTimePicker(){
  const trig = document.getElementById('dtpTimeTrig');
  const pop = document.getElementById('dtpTimePop');
  const val = trig.querySelector('.dtp-val');
  const selH = document.getElementById('dtpH');
  const selM = document.getElementById('dtpM');
  const ok = document.getElementById('dtpTimeOk');
  for (let h = 7; h <= 21; h++) selH.insertAdjacentHTML('beforeend', `<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`);
  for (let m of [0,15,30,45]) selM.insertAdjacentHTML('beforeend', `<option value="${String(m).padStart(2,'0')}">${String(m).padStart(2,'0')}</option>`);
  trig.addEventListener('click', e => {
    e.stopPropagation();
    const open = pop.classList.contains('show');
    document.querySelectorAll('.dtp-pop.show').forEach(p => p.classList.remove('show'));
    document.querySelectorAll('.dtp-trig.active').forEach(t => t.classList.remove('active'));
    if (!open) { pop.classList.add('show'); trig.classList.add('active'); }
  });
  ok.addEventListener('click', () => {
    const t = `${selH.value}:${selM.value}`;
    state.scheduledTime = t;
    val.textContent = t; trig.classList.remove('empty');
    pop.classList.remove('show'); trig.classList.remove('active');
    saveDraft(); onAnyChange();
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('dtpTime').contains(e.target)) { pop.classList.remove('show'); trig.classList.remove('active'); }
  });
})();

// ===== UPLOAD + NOTE =====
document.getElementById('fileUp').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 5 * 1024 * 1024) { alert('Fichier trop volumineux (5 Mo max).'); return; }
  state.file = f.name;
  document.getElementById('uploadLbl').textContent = f.name;
  document.getElementById('uploadBox').classList.add('has-file');
});
document.getElementById('note').addEventListener('input', e => { state.note = e.target.value; saveDraft(); });

// ===== VALIDATIONS PAR ETAPE =====
// Étape 1 : Itinéraire (collecte + livraisons)
function step1Valid() {
  if (!state.pickup.coords || !P.canPickupAt(state.pickup.postalCode).ok) return false;
  if (!state.pickup.first.trim() || !state.pickup.last.trim()) return false;
  if (!state.stops.length) return false;
  for (const s of state.stops) if (!stopValid(s)) return false;
  return true;
}
// Étape 2 : Détails (véhicule + planning)
function step2Valid() {
  if (state.timing === 'scheduled' && (!state.scheduledDate || !state.scheduledTime)) return false;
  return true;
}
// Étape 3 : Paiement (commanditaire + récap)
function step3Valid() {
  if (!state.contact.name.trim()) return false;
  if (!isEmail(state.contact.email)) return false;
  if (!isPhone(state.contact.phone)) return false;
  return true;
}

// ===== STEP NAV =====
function setStep(n) {
  state.step = n;
  document.querySelectorAll('.step-pane').forEach(p => p.classList.toggle('active', Number(p.dataset.pane) === n));
  document.querySelectorAll('.stp').forEach(s => {
    const num = Number(s.dataset.step);
    s.classList.toggle('active', num === n);
    s.classList.toggle('done', num < n);
  });
  document.querySelectorAll('.stp-line').forEach(l => l.classList.toggle('done', Number(l.dataset.line) < n));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (n === 3) renderRecap();
  onAnyChange();
}
document.getElementById('step1Next').addEventListener('click', () => { if (step1Valid()) setStep(2); });
document.getElementById('step2Back').addEventListener('click', () => setStep(1));
document.getElementById('step2Next').addEventListener('click', () => { if (step2Valid()) setStep(3); });
document.getElementById('step3Back').addEventListener('click', () => setStep(2));
document.querySelectorAll('.recap-edit').forEach(b => b.addEventListener('click', () => setStep(Number(b.dataset.goto))));

// ===== LIVE PRICING =====
const debouncedEstimate = debounce(async () => {
  // On estime des que pickup OK + au moins 1 stop valide
  if (!state.pickup.coords || !P.canPickupAt(state.pickup.postalCode).ok) {
    state.pricing = null; state.pricingError = null; state.pricingLoading = false; renderSummary(); return;
  }
  const usable = state.stops.filter(s => stopValid(s));
  if (!usable.length) { state.pricing = null; state.pricingError = null; state.pricingLoading = false; renderSummary(); return; }

  state.pricingLoading = true; renderSummary();
  try {
    const res = await P.estimatePrice({
      pickup: { label: state.pickup.label, coordinates: state.pickup.coords, postalCode: state.pickup.postalCode },
      stops: usable.map(s => ({ label: s.label, coordinates: s.coords, postalCode: s.postalCode })),
      vehicleMode: state.vehicle,
      isUrgent: state.timing === 'express',
    });
    state.pricingLoading = false;
    if (res.ok) { state.pricing = res; state.pricingError = null; }
    else { state.pricing = null; state.pricingError = res; }
    renderSummary();
    updateUrgentPrice();
    // Check optimization si >= 3 stops
    if (usable.length >= 3) debouncedOptim(); else { state.optim = null; renderOptim(); }
  } catch (e) {
    state.pricingLoading = false; state.pricing = null;
    renderSummary();
  }
}, 400);

function onAnyChange() {
  document.getElementById('step1Next').disabled = !step1Valid();
  document.getElementById('step2Next').disabled = !(step1Valid() && step2Valid());
  debouncedEstimate();
}

function updateUrgentPrice() {
  // Bloc options supprime — plus rien a mettre a jour cote UI
}

// ===== OPTIMIZATION SUGGESTION =====
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i+1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

const debouncedOptim = debounce(async () => {
  if (state.optimDismissed) return;
  const usable = state.stops.filter(s => stopValid(s));
  if (usable.length < 3 || usable.length > 5) { state.optim = null; renderOptim(); return; }
  if (!state.pricing) return;
  const currentTotal = state.pricing.totalTTC;
  let best = null;
  const perms = permutations(usable.map((_, i) => i));
  for (const perm of perms) {
    const reordered = perm.map(i => usable[i]);
    const sameOrder = perm.every((v, i) => v === i);
    if (sameOrder) continue;
    try {
      const res = await P.estimatePrice({
        pickup: { label: state.pickup.label, coordinates: state.pickup.coords, postalCode: state.pickup.postalCode },
        stops: reordered.map(s => ({ label: s.label, coordinates: s.coords, postalCode: s.postalCode })),
        vehicleMode: state.vehicle,
        isUrgent: state.timing === 'express',
      });
      if (res.ok && res.totalTTC < currentTotal - 0.5) {
        if (!best || res.totalTTC < best.total) best = { total: res.totalTTC, ids: reordered.map(s => s.id) };
      }
    } catch(e) {}
  }
  if (best) {
    state.optim = { orderIds: best.ids, saving: currentTotal - best.total };
  } else {
    state.optim = null;
  }
  renderOptim();
}, 800);

function renderOptim() {
  const el = document.getElementById('optimSuggest');
  const txt = document.getElementById('optimSuggestTxt');
  if (!state.optim || state.optimDismissed) { el.classList.remove('show'); return; }
  txt.innerHTML = `Un ordre optimisé est <strong>−${formatCHF(state.optim.saving)} CHF</strong> moins cher.`;
  el.classList.add('show');
}
document.getElementById('optimApply').addEventListener('click', () => {
  if (!state.optim) return;
  const prev = captureRects();
  const byId = new Map(state.stops.map(s => [s.id, s]));
  const newOrder = [];
  for (const id of state.optim.orderIds) { const s = byId.get(id); if (s) { newOrder.push(s); byId.delete(id); } }
  for (const s of byId.values()) newOrder.push(s);
  state.stops = newOrder;
  state.optim = null;
  renderStops();
  flipAnimate(prev);
  renderOptim();
  saveDraft(); onAnyChange();
});
document.getElementById('optimDismiss').addEventListener('click', () => { state.optimDismissed = true; renderOptim(); });

// ===== SUMMARY =====
function renderSummary() {
  const sumRoute = document.getElementById('sumRoute');
  const sumMeta = document.getElementById('sumMeta');
  const sumLines = document.getElementById('sumLines');
  const sumTotal = document.getElementById('sumTotal');
  const sumLoading = document.getElementById('sumLoading');
  const sumZoneSlot = document.getElementById('sumZoneSlot');
  const sumMobileVal = document.getElementById('sumMobileVal');
  const sumMobileCta = document.getElementById('sumMobileCta');

  const hasPickup = !!state.pickup.label;
  const anyStop = state.stops.some(s => s.label);

  if (hasPickup || anyStop) {
    let html = '<div class="sum-route">';
    if (hasPickup) html += `<div class="sum-stop pickup"><div class="sum-stop-dot"></div><div class="sum-stop-line"></div><div class="sum-stop-txt"><strong>Collecte</strong><span class="sum-addr">${escapeHtml(state.pickup.label)}</span></div></div>`;
    state.stops.forEach((s, i) => {
      if (s.label) html += `<div class="sum-stop"><div class="sum-stop-dot"></div><div class="sum-stop-line"></div><div class="sum-stop-txt"><strong>Livraison ${state.stops.length>1?`#${i+1}`:''}</strong><span class="sum-addr">${escapeHtml(s.label)}</span></div></div>`;
    });
    html += '</div>';
    sumRoute.innerHTML = html;
  } else {
    sumRoute.innerHTML = `<div class="sum-empty">Renseignez la collecte et au moins une livraison pour voir le prix exact.</div>`;
  }

  const zone = state.pickup.coords ? P.findZoneByPostalCode(state.pickup.postalCode) : null;
  sumZoneSlot.innerHTML = zone ? zoneBadgeHtml(zone, true) : '';

  const sumMetaWrap = document.getElementById('sumMetaWrap');
  if (state.pricing) {
    if (sumMetaWrap) sumMetaWrap.style.display = '';
    sumMeta.style.display = 'flex';
    const vehIcon = state.vehicle === 'bike'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 17.5h-6l-3-8H3"/><path d="M12 5l2 4.5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7" cy="14" r="1" fill="currentColor"/><circle cx="17" cy="14" r="1" fill="currentColor"/></svg>';
    const vehLabel = state.vehicle === 'bike' ? 'Vélo' : 'Voiture';
    document.getElementById('sumVehicle').innerHTML = '<span class="sum-pill sum-pill-veh">' + vehIcon + '<span>' + vehLabel + '</span></span>';
    if (state.timing === 'express') {
      document.getElementById('sumTiming').innerHTML = '<span class="sum-pill sum-pill-express"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Super Express <em>&lt;2h</em></span></span>';
    } else {
      const planLbl = state.scheduledDate && state.scheduledTime
        ? `${state.scheduledDate.split('-').reverse().join('/')} · ${state.scheduledTime}`
        : 'Planifié';
      document.getElementById('sumTiming').innerHTML = '<span class="sum-pill sum-pill-planned"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>' + escapeHtml(planLbl) + '</span></span>';
    }
  } else {
    if (sumMetaWrap) sumMetaWrap.style.display = 'none';
    sumMeta.style.display = 'none';
  }

  sumLoading.classList.toggle('show', state.pricingLoading);

  const sumLinesWrap = document.getElementById('sumLinesWrap');
  if (state.pricing) {
    const p = state.pricing;
    if (sumLinesWrap) sumLinesWrap.style.display = '';
    sumLines.style.display = 'flex';
    let lines = '';
    if (p.pickup.costHT > 0) {
      lines += `<div class="sum-line"><span class="sum-line-lbl">Collecte <em>${p.pickup.distanceKm.toFixed(1)} km</em></span><strong>CHF ${formatCHF(p.pickup.costHT)}</strong></div>`;
    }
    p.segments.forEach(s => {
      lines += `<div class="sum-line"><span class="sum-line-lbl">${escapeHtml(s.fromLabel)} → ${escapeHtml(s.toLabel)} <em>${s.distanceKm.toFixed(1)} km</em></span><strong>CHF ${formatCHF(s.costHT)}</strong></div>`;
    });
    if (p.urgencyCost) lines += `<div class="sum-line sum-line-extra"><span class="sum-line-lbl">Supplément urgence <em>${escapeHtml(p.zone.name)}</em></span><strong>+CHF ${formatCHF(p.urgencyCost)}</strong></div>`;
    lines += `<div class="sum-line sum-line-tax"><span class="sum-line-lbl">TVA <em>${(p.vatRate*100).toFixed(1)}%</em></span><strong>CHF ${formatCHF(p.vat)}</strong></div>`;
    sumLines.innerHTML = lines;
    sumTotal.style.display = 'flex';
    document.getElementById('sumTotalVal').innerHTML = `<small>CHF</small> ${formatCHF(p.totalTTC)}`;
    sumMobileVal.classList.remove('empty');
    sumMobileVal.textContent = `CHF ${formatCHF(p.totalTTC)}`;
    document.getElementById('payAmount').textContent = `CHF ${formatCHF(p.totalTTC)}`;
  } else {
    if (sumLinesWrap) sumLinesWrap.style.display = 'none';
    sumLines.style.display = 'none';
    sumTotal.style.display = 'none';
    sumMobileVal.classList.add('empty');
    sumMobileVal.textContent = state.pricingError ? 'Adresse non couverte' : (state.step === 1 ? 'Complétez l\'itinéraire' : 'En attente...');
    document.getElementById('payAmount').textContent = '—';
  }

  // Mobile CTA
  if (state.step === 1) {
    sumMobileCta.innerHTML = `Continuer <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    sumMobileCta.classList.remove('stripe');
    sumMobileCta.disabled = !step1Valid();
    sumMobileCta.onclick = () => { if (step1Valid()) setStep(2); };
  } else if (state.step === 2) {
    sumMobileCta.innerHTML = `Continuer <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    sumMobileCta.classList.remove('stripe');
    sumMobileCta.disabled = !(step1Valid() && step2Valid());
    sumMobileCta.onclick = () => { if (step1Valid() && step2Valid()) setStep(3); };
  } else {
    sumMobileCta.innerHTML = `Payer <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
    sumMobileCta.classList.add('stripe');
    sumMobileCta.disabled = !state.pricing;
    sumMobileCta.onclick = () => document.getElementById('payBtn').click();
  }
}

// ===== RECAP (step 2) =====
function renderRecap() {
  // --- Badges header ---
  const stopsCount = state.stops.length;
  const timingBadge = document.getElementById('payBadgeTiming');
  const stopsBadge = document.getElementById('payBadgeStops');
  const vehBadge = document.getElementById('payBadgeVehicle');
  if (timingBadge) timingBadge.textContent = state.timing === 'express' ? 'Super Express' : 'Planifiée';
  if (stopsBadge) {
    const span = stopsBadge.querySelector('span');
    if (span) span.textContent = `${stopsCount} ${stopsCount > 1 ? 'Tournée' : 'Arrêt'}`;
    // numero dans la pastille sombre : je remplace le span interne
    // structure: <svg/> <span>...</span>
  }
  if (vehBadge) {
    const span = vehBadge.querySelector('span');
    if (span) span.textContent = state.vehicle === 'bike' ? 'Vélo' : 'Voiture';
  }

  // --- Pickup when ---
  const when = document.getElementById('payPickupWhen');
  if (when) {
    const date = state.timing === 'express'
      ? 'sous 2 heures, aujourd\'hui'
      : `le <strong>${fmtDateLong(state.scheduledDate)} à ${state.scheduledTime || '—'}</strong>`;
    when.innerHTML = `Collecte prévue ${date}`;
  }

  // --- Timeline (gouttiere gauche) ---
  const tl = document.getElementById('payTimeline');
  if (tl) {
    let h = '';
    // Ligne 1 : Point de collecte
    const pComp = state.pickup.society ? `<span class="pay-tl-comp">${escapeHtml(state.pickup.society)}</span>` : '';
    h += `<div class="pay-tl-row head">
      <div class="pay-tl-gutter">
        <div class="pay-tl-icon store"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5M3 9v11h18V9M3 9h18"/><path d="M8 14h8"/></svg></div>
      </div>
      <span class="pay-tl-line"></span>
      <div class="pay-tl-content">
        <div class="pay-tl-label">Point de collecte</div>
        <div class="pay-tl-name">${escapeHtml((state.pickup.first+' '+state.pickup.last).trim() || '—')}${pComp}</div>
        <div class="pay-tl-addr">${escapeHtml(state.pickup.label || '—')}</div>
      </div>
    </div>`;
    // Ligne 2 : header "Livraisons"
    h += `<div class="pay-tl-row head">
      <div class="pay-tl-gutter">
        <div class="pay-tl-icon pin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
      </div>
      <span class="pay-tl-line"></span>
      <div class="pay-tl-content">
        <div class="pay-tl-label" style="margin-bottom:0">Livraisons</div>
      </div>
    </div>`;
    // Lignes 3+ : stops numerotes
    state.stops.forEach((s, i) => {
      const sc = s.society ? `<span class="pay-tl-comp">${escapeHtml(s.society)}</span>` : '';
      h += `<div class="pay-tl-row stop">
        <div class="pay-tl-gutter"><div class="pay-tl-num">${i+1}</div></div>
        <span class="pay-tl-line"></span>
        <div class="pay-tl-content">
          <div class="pay-tl-name">${escapeHtml((s.first+' '+s.last).trim() || '—')}${sc}</div>
          <div class="pay-tl-addr">${escapeHtml(s.label || '—')}</div>
        </div>
      </div>`;
    });
    tl.innerHTML = h;
  }

  // --- Distance & durée & arrêts meta ---
  if (state.pricing) {
    const p = state.pricing;
    const totalKm = p.pickup.distanceKm + p.deliveryDistance;
    const distEl = document.getElementById('payDistance');
    if (distEl) distEl.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg> <em>${totalKm.toFixed(1)} km</em>`;
    const durEl = document.getElementById('payDuration');
    if (durEl) durEl.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l3 2"/></svg> <em>${fmtDuration(p.durationSeconds)}</em>`;
    const arEl = document.getElementById('payArrets');
    if (arEl) arEl.textContent = `${stopsCount} ${stopsCount > 1 ? 'arrêts' : 'arrêt'}`;
  }

  // --- Course breakdown ---
  const courseTotal = document.getElementById('payCourseTotal');
  const costLines = document.getElementById('payCostLines');
  const payTotal = document.getElementById('payTotal');
  if (state.pricing) {
    const p = state.pricing;
    if (courseTotal) courseTotal.textContent = `CHF ${formatCHF(p.routeSubtotalHT)}`;
    if (costLines) {
      let c = '';
      c += `<div class="pay-cost-line"><span class="pay-cost-line-lbl">Collecte <em>${p.pickup.distanceKm.toFixed(1)} km</em></span><span class="pay-cost-line-val">CHF ${formatCHF(p.pickup.costHT)}</span></div>`;
      const livTotal = p.deliveryCost;
      c += `<div class="pay-cost-line"><span class="pay-cost-line-lbl">Livraison · ${stopsCount} ${stopsCount>1?'arrêts':'arrêt'} <em>${p.deliveryDistance.toFixed(1)} km</em></span><span class="pay-cost-line-val">CHF ${formatCHF(livTotal)}</span></div>`;
      if (p.urgencyCost) c += `<div class="pay-cost-line"><span class="pay-cost-line-lbl">Supplément Super Express</span><span class="pay-cost-line-val">+CHF ${formatCHF(p.urgencyCost)}</span></div>`;
      c += `<div class="pay-cost-line"><span class="pay-cost-line-lbl">TVA ${(p.vatRate*100).toFixed(1)}%</span><span class="pay-cost-line-val">CHF ${formatCHF(p.vat)}</span></div>`;
      costLines.innerHTML = c;
    }
    if (payTotal) payTotal.textContent = `CHF ${formatCHF(p.totalTTC)}`;
    document.getElementById('payAmount').textContent = `CHF ${formatCHF(p.totalTTC)}`;
  } else {
    if (courseTotal) courseTotal.textContent = 'CHF —';
    if (costLines) costLines.innerHTML = '';
    if (payTotal) payTotal.textContent = 'CHF —';
  }

  // --- Super Express supplement switch UI ---
  const supSw = document.getElementById('supSuperExpressSw');
  const supRow = document.getElementById('supSuperExpress');
  const supUnav = document.getElementById('supSuperExpressUnav');
  if (supSw) supSw.parentElement.classList.toggle('active', state.timing === 'express');
  if (supRow) {
    const available = isExpressAvailable();
    supRow.classList.toggle('disabled', !available);
    if (supUnav) supUnav.style.display = available ? 'none' : 'flex';
  }
}

function fmtDuration(totalSec) {
  if (!totalSec || totalSec < 60) return '< 1 min';
  const mins = Math.round(totalSec / 60);
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `~${h}h ${m}min` : `~${h}h`;
}

function fmtDateLong(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${parseInt(d,10)} ${MONTHS[parseInt(m,10)-1]} ${y}`;
}

// ===== STEP 3 : Supplements & Promo =====
(function initSupplements(){
  // Super Express toggle : switch state.timing between express / scheduled
  const row = document.getElementById('supSuperExpress');
  if (row) row.addEventListener('click', () => {
    if (!isExpressAvailable()) return;
    state.timing = state.timing === 'express' ? 'scheduled' : 'express';
    applyTiming();
    renderRecap();
    onAnyChange();
  });
  // Livreur supplementaire (flag uniquement pour l'instant, pas de prix cote mock)
  const extraRow = document.querySelector('[data-sup="additional_courier"]');
  if (extraRow) extraRow.addEventListener('click', () => {
    state.supplements.additionalCourier = !state.supplements.additionalCourier;
    extraRow.querySelector('.switch').parentElement.classList.toggle('active', state.supplements.additionalCourier);
    onAnyChange();
  });
})();

(function initPromo(){
  const inp = document.getElementById('promoInp');
  const btn = document.getElementById('promoApply');
  if (!inp || !btn) return;
  btn.addEventListener('click', () => {
    const code = inp.value.trim().toUpperCase();
    if (!code) return;
    // Mock : PROMO10 applique -10% fictif sur subtotal (pour demo seulement)
    if (code === 'PROMO10') {
      state.promo = { code, applied: { pct: 10 } };
      btn.textContent = 'Appliqué'; btn.style.background = '#1A7A6E';
    } else {
      btn.textContent = 'Code invalide'; btn.style.background = '#ed1724';
      setTimeout(() => { btn.textContent = 'Appliquer'; btn.style.background = ''; }, 1800);
      state.promo = { code, applied: null };
    }
    onAnyChange();
  });
  inp.addEventListener('input', e => { state.promo.code = e.target.value; if (state.promo.applied && e.target.value.trim().toUpperCase() !== state.promo.applied.code) { state.promo.applied = null; btn.textContent = 'Appliquer'; btn.style.background = ''; onAnyChange(); } });
})();

// ===== PAY (simulation Stripe Checkout) =====
async function simulateStripePayment() {
  const sim = document.getElementById('stripeSim');
  const ic = document.getElementById('stripeSimIc');
  const title = document.getElementById('stripeSimTitle');
  const sub = document.getElementById('stripeSimSub');
  const amount = document.getElementById('stripeSimAmount');
  if (!sim || !state.pricing) return;

  amount.textContent = `CHF ${formatCHF(state.pricing.totalTTC)}`;
  ic.classList.add('loading'); ic.classList.remove('ok');
  ic.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
  title.textContent = 'Paiement en cours';
  sub.textContent = 'Connexion sécurisée avec Stripe...';
  sim.classList.add('show');

  // Simule traitement ~1.4s
  await new Promise(r => setTimeout(r, 1400));
  title.textContent = 'Vérification 3D-Secure';
  sub.textContent = 'Validation de votre carte...';
  await new Promise(r => setTimeout(r, 900));

  // Success
  ic.classList.remove('loading'); ic.classList.add('ok');
  ic.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  title.textContent = 'Paiement accepté';
  sub.textContent = 'Redirection vers la confirmation...';
  await new Promise(r => setTimeout(r, 1100));
  sim.classList.remove('show');

  // Redirect to success screen
  const orderId = 'CH-' + Date.now().toString(36).toUpperCase().slice(-7);
  document.getElementById('successOrderId').textContent = orderId;
  const emailEl = document.getElementById('successEmail');
  if (emailEl) emailEl.textContent = state.contact.email;
  document.getElementById('screenForm').classList.remove('active');
  document.getElementById('screenSuccess').classList.add('active');
  document.getElementById('summaryMobile').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  clearDraft();
}

document.getElementById('payBtn').addEventListener('click', () => {
  if (!state.pricing) { alert('Prix non calculé.'); return; }
  if (!step3Valid()) {
    alert('Veuillez renseigner votre nom, email et téléphone pour recevoir le suivi.');
    const missing = !state.contact.name.trim() ? 'contactName' : (!isEmail(state.contact.email) ? 'contactEmail' : 'contactPhone');
    const el = document.getElementById(missing);
    if (el) { el.classList.add('err'); el.focus(); }
    return;
  }
  simulateStripePayment();
});
document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
  if (window._pwaPrompt && window._pwaPrompt.prompt) {
    window._pwaPrompt.prompt();
    try { await window._pwaPrompt.userChoice; } catch(e){}
  } else {
    alert('iOS : Partager → Sur l\'écran d\'accueil.\nAndroid : Menu ⋮ → Installer l\'application.');
  }
});
document.getElementById('successClose').addEventListener('click', () => { window.location.href = 'index.html'; });
document.getElementById('successCopy').addEventListener('click', (e) => {
  const id = document.getElementById('successOrderId').textContent;
  navigator.clipboard?.writeText(id).then(() => {
    e.target.textContent = 'Copié';
    e.target.classList.add('copied');
    setTimeout(() => { e.target.textContent = 'Copier'; e.target.classList.remove('copied'); }, 1600);
  });
});

// ===== DEV AUTOFILL =====
(function devAutofill(){
  const btn = document.getElementById('devAutofillBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const prev = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:cmd-spin .7s linear infinite"></span> Remplissage...`;

    // Commanditaire
    state.contact = { name: 'Alexandre Moreira', email: 'alexandre.moreira.pro@gmail.com', phone: '+41 79 456 78 90', company: 'Chaskis Test' };
    ['contactName','contactEmail','contactPhone','contactCompany'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const key = id.replace('contact','').toLowerCase();
      el.value = state.contact[key] || '';
    });

    try {
      // Pickup Zone 1 Genève
      const pickupGeo = await P.geocodeAddress('Rue du Mont-Blanc 14 1201 Genève');
      if (!pickupGeo) throw new Error('geocode pickup failed');
      Object.assign(state.pickup, {
        addr: pickupGeo.label, label: pickupGeo.label,
        coords: pickupGeo.coordinates, postalCode: pickupGeo.postalCode,
        first: 'Alexandre', last: 'Moreira', society: 'Chaskis Test SA',
        collapsed: false, validated: true,
      });
      document.getElementById('pickupAddr').value = pickupGeo.label;
      document.getElementById('pickupFirst').value = 'Alexandre';
      document.getElementById('pickupLast').value = 'Moreira';
      document.getElementById('pickupSociety').value = 'Chaskis Test SA';
      if (window._updatePickupCoverage) window._updatePickupCoverage();

      // 2 stops Genève, validés + collapsed
      state.stops = [];
      const drops = [
        { addr: 'Rue de la Servette 60 1202 Genève', first: 'Julie', last: 'Bernard', phone: '+41 79 123 45 67', society: 'Atelier Bernard', note: '2e étage, code 4321B' },
        { addr: 'Route de Malagnou 20 1208 Genève', first: 'Marc', last: 'Dubois', phone: '+41 78 234 56 78', society: '', note: 'Réception' },
      ];
      for (const d of drops) {
        const g = await P.geocodeAddress(d.addr);
        if (!g) continue;
        const s = makeStop();
        Object.assign(s, {
          addr: g.label, label: g.label,
          coords: g.coordinates, postalCode: g.postalCode,
          first: d.first, last: d.last, phone: d.phone, society: d.society, note: d.note,
          collapsed: true, validated: true,
        });
        state.stops.push(s);
      }
      renderStops();

      // Timing : Super Express si dispo, sinon Planifier demain 9h
      if (isExpressAvailable()) {
        state.timing = 'express';
      } else {
        state.timing = 'scheduled';
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        state.scheduledDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
        state.scheduledTime = '09:00';
        // MaJ UI DateTimePicker
        const dv = document.querySelector('#dtpDateTrig .dtp-val');
        if (dv) { dv.textContent = state.scheduledDate.split('-').reverse().join('/'); document.getElementById('dtpDateTrig').classList.remove('empty'); }
        const tv = document.querySelector('#dtpTimeTrig .dtp-val');
        if (tv) { tv.textContent = state.scheduledTime; document.getElementById('dtpTimeTrig').classList.remove('empty'); }
      }
      applyTiming();

      saveDraft(); onAnyChange();
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Rempli`;
      setTimeout(() => { btn.innerHTML = prev; btn.disabled = false; }, 1500);
    } catch (e) {
      console.error('[autofill]', e);
      btn.innerHTML = prev; btn.disabled = false;
      alert('Échec autofill : ' + e.message);
    }
  });
})();

// ===== INIT =====
loadDraft();
renderStops();
updateUrgentPrice();
onAnyChange();

})();

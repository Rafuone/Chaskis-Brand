/* Chaskis — pages/app.js : logique de la mini-app PWA (ex-inline) */
const ORDERS_KEY = 'chaskis_orders';
/* Échappement HTML local (app.html ne charge PAS utils.js/window.CK). Toute donnée issue de
   l'URL (?code) ou du localStorage (adresses/email saisis dans le formulaire Commander) passe
   par esc() avant insertion en innerHTML — anti-XSS. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/* Format d'un numéro de suivi valide (identique à submitAddCode). Un code hors format n'est
   ni stocké ni rendu → neutralise le XSS réfléchi/persistant via ?code. */
const CODE_RE = /^CH-[A-Z0-9]{6,10}$/;
const STATUSES = [
  { key:'confirmed', label:'Commande confirmée', hint:'Votre demande a été enregistrée.', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' },
  { key:'pickup',    label:'Retrait en cours',   hint:'Un coursier est en route vers le point de retrait.', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 7L9 18l-5-5"/></svg>' },
  { key:'en-route',  label:'En route',            hint:'Le colis est acheminé vers la destination.', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' },
  { key:'delivered', label:'Livré',               hint:'Le colis a été remis au destinataire.', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' },
];
const STATUS_LABEL = { confirmed:'Confirmée', pickup:'Retrait', 'en-route':'En route', delivered:'Livrée' };

// ===== STORAGE HELPERS =====
function loadOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(o => o && o.code) : [];
  } catch (e) { return []; }
}
function saveOrders(list) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
}
function upsertOrder(order) {
  const list = loadOrders();
  const filtered = list.filter(o => o.code !== order.code);
  filtered.unshift(order);
  saveOrders(filtered.slice(0, 20));
}
function findOrder(code) {
  return loadOrders().find(o => o.code === code) || null;
}

// ===== STATUS MOCK (derived from createdAt) =====
// Provides a "live" feel without a backend: status progresses over time.
function deriveStatus(order) {
  if (!order || !order.createdAt) return 'confirmed';
  if (order.status === 'delivered') return 'delivered';
  const elapsed = (Date.now() - order.createdAt) / 1000;
  if (elapsed < 60)  return 'confirmed';
  if (elapsed < 180) return 'pickup';
  if (elapsed < 360) return 'en-route';
  return 'delivered';
}
function etaFromStatus(order, status) {
  const total = 360; // 6 minutes for the mock full cycle
  const elapsed = Math.max(0, (Date.now() - order.createdAt) / 1000);
  const left = Math.max(0, total - elapsed);
  if (status === 'delivered') return 'Livré';
  const mins = Math.ceil(left / 60);
  return '~' + mins + ' min';
}

// ===== ROUTING =====
// State lives in the URL: ?code=CH-XXX opens detail; otherwise list.
function currentCode() {
  const u = new URL(location.href);
  const c = (u.searchParams.get('code') || '').trim().toUpperCase();
  return CODE_RE.test(c) ? c : null; // code hors format ignoré (ni stocké ni rendu)
}
function goDetail(code) {
  const u = new URL(location.href);
  u.searchParams.set('code', code);
  history.pushState({ code }, '', u);
  render();
}
function goList() {
  const u = new URL(location.href);
  u.searchParams.delete('code');
  history.pushState({}, '', u);
  render();
}
window.addEventListener('popstate', render);

// ===== RENDER =====
function render() {
  const code = currentCode();
  const titleEl = document.getElementById('appTitle');
  const content = document.getElementById('appContent');

  if (code) {
    // Auto-add to localStorage if not already there (deep link case)
    let order = findOrder(code);
    if (!order) {
      order = { code, createdAt: Date.now(), pickup:null, stops:[], contact:null, status:'confirmed', trackUrl: location.origin + '/suivi/' + code };
      upsertOrder(order);
    }
    titleEl.textContent = 'Commande';
    renderDetail(order);
    return;
  }

  titleEl.textContent = 'Suivi';
  renderList();
}

function renderList() {
  const orders = loadOrders();
  const content = document.getElementById('appContent');

  if (orders.length === 0) {
    content.innerHTML = `
      <div class="empty-wrap fade-in">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V6a5 5 0 0 1 10 0v2"/></svg>
        <h3>Aucune commande suivie</h3>
        <p>Passez une commande et votre suivi s'affichera ici automatiquement. Vous pouvez aussi ajouter un code manuellement.</p>
        <div class="empty-actions">
          <a class="btn-pri" href="commander.html">Commander une course</a>
          <button class="btn-sec" id="empAddCode">J'ai un code</button>
        </div>
      </div>`;
    document.getElementById('empAddCode').addEventListener('click', openAddOverlay);
    return;
  }

  // Active orders first (derived), then delivered
  const derived = orders.map(o => ({ ...o, _status: deriveStatus(o) }));
  const active = derived.filter(o => o._status !== 'delivered');
  const done   = derived.filter(o => o._status === 'delivered');

  let html = '';
  if (active.length) {
    html += `<div class="section-title">En cours</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:10px">`;
    html += active.map(o => orderCardHtml(o)).join('');
    html += `</div>`;
  }
  if (done.length) {
    html += `<div class="section-title" style="margin-top:14px">Historique</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:10px">`;
    html += done.map(o => orderCardHtml(o)).join('');
    html += `</div>`;
  }
  html += `
    <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">
      <a class="btn-pri" href="commander.html">Commander une nouvelle course</a>
    </div>`;
  content.innerHTML = html;

  // Attach click handlers
  content.querySelectorAll('.order-card').forEach(el => {
    el.addEventListener('click', () => goDetail(el.dataset.code));
  });
}

function orderCardHtml(order) {
  const s = order._status || deriveStatus(order);
  const routeFrom = order.pickup && (order.pickup.label || order.pickup.addr) || 'Adresse de retrait';
  const firstStop = order.stops && order.stops[0];
  const routeTo = firstStop ? (firstStop.label || firstStop.addr) : 'Adresse de livraison';
  const extra = order.stops && order.stops.length > 1 ? ` + ${order.stops.length - 1}` : '';
  return `
    <div class="order-card fade-in" data-code="${esc(order.code)}" role="button" tabindex="0">
      <div class="oc-head">
        <span class="oc-code">${esc(order.code)}</span>
        <span class="oc-badge ${s}">${STATUS_LABEL[s]}</span>
      </div>
      <div class="oc-route">
        <b>A.</b> ${esc(shortAddr(routeFrom))}<br>
        <b>B.</b> ${esc(shortAddr(routeTo))}${extra ? `<span style="color:var(--ink-muted)">${esc(extra)}</span>` : ''}
      </div>
      <div class="oc-meta">
        <span>${formatDate(order.createdAt)}</span>
        <span class="oc-meta-r">
          ${s === 'delivered' ? 'Voir le détail' : etaFromStatus(order, s)}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    </div>`;
}

function renderDetail(order) {
  const s = deriveStatus(order);
  const currentIdx = STATUSES.findIndex(st => st.key === s);
  const content = document.getElementById('appContent');

  const stopsHtml = (order.stops || []).map((stop, i) => `
    <div class="dh-route-row">
      <div class="dh-route-ic ${i === 0 ? 'b' : 'b-extra'}">${i === 0 ? 'B' : (i + 1)}</div>
      <div class="dh-route-txt">${esc(stop.label || stop.addr || 'Adresse de livraison')}</div>
    </div>`).join('');

  const priceMeta = order.pricing && order.pricing.totalTTC != null
    ? `<span><b>Total :</b> CHF ${formatCHF(order.pricing.totalTTC)} TTC</span>` : '';
  const contactMeta = order.contact && order.contact.email
    ? `<span><b>Alertes :</b> ${esc(order.contact.email)}</span>` : '';

  const timelineHtml = STATUSES.map((st, i) => {
    const cls = i < currentIdx ? 'done' : (i === currentIdx ? 'active' : '');
    return `
      <div class="tl-step ${cls}">
        <div class="tl-dot">${st.icon}</div>
        <div class="tl-body">
          <div class="tl-label">${st.label}</div>
          <div class="tl-hint">${st.hint}</div>
        </div>
      </div>`;
  }).join('');

  const trackUrl = order.trackUrl || (location.origin + '/suivi/' + order.code);

  content.innerHTML = `
    <button class="back-btn" id="backBtn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      Toutes mes commandes
    </button>

    <div class="detail-head fade-in">
      <div class="dh-top">
        <div>
          <div class="dh-code-lbl">Numéro</div>
          <div class="dh-code">${esc(order.code)}</div>
        </div>
        <span class="oc-badge ${s}">${STATUS_LABEL[s]}</span>
      </div>
      <div class="dh-route">
        <div class="dh-route-row">
          <div class="dh-route-ic a">A</div>
          <div class="dh-route-txt">${esc(order.pickup && (order.pickup.label || order.pickup.addr) || 'Adresse de retrait non renseignée')}</div>
        </div>
        ${stopsHtml || `<div class="dh-route-row"><div class="dh-route-ic b">B</div><div class="dh-route-txt" style="color:var(--ink-muted)">Adresse de livraison non disponible</div></div>`}
      </div>
      <div class="dh-meta">
        <span><b>${formatDate(order.createdAt)}</b></span>
        ${priceMeta}
        ${contactMeta}
      </div>
    </div>

    <div class="timeline-card fade-in" style="animation-delay:.05s">
      <div class="tl-title">Progression ${s !== 'delivered' ? '· ETA ' + etaFromStatus(order, s) : ''}</div>
      ${timelineHtml}
    </div>

    <div class="share-card fade-in" style="animation-delay:.1s">
      <div class="share-card-info">
        <strong>Partager le suivi</strong>
        <span>Lien direct pour votre destinataire</span>
      </div>
      <button class="share-card-btn" id="shareBtn" data-link="${esc(trackUrl)}">Copier</button>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', goList);
  document.getElementById('shareBtn').addEventListener('click', e => {
    const link = e.currentTarget.dataset.link;
    navigator.clipboard?.writeText(link).then(() => {
      e.currentTarget.textContent = 'Copié !';
      e.currentTarget.classList.add('copied');
      showToast('Lien de suivi copié');
      setTimeout(() => {
        e.currentTarget.textContent = 'Copier';
        e.currentTarget.classList.remove('copied');
      }, 1800);
    });
  });
}

// ===== HELPERS =====
function shortAddr(s) {
  if (!s) return '';
  // Keep first part before comma, else truncate
  const comma = s.indexOf(',');
  if (comma > 0) return s.slice(0, comma);
  return s.length > 42 ? s.slice(0, 40) + '…' : s;
}
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString('fr-CH', { hour:'2-digit', minute:'2-digit' });
  if (sameDay) return `Aujourd'hui ${hm}`;
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  if (d.toDateString() === yd.toDateString()) return `Hier ${hm}`;
  return d.toLocaleDateString('fr-CH', { day:'2-digit', month:'short' }) + ' ' + hm;
}
function formatCHF(n) {
  return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ===== ADD CODE OVERLAY =====
const addOverlay = document.getElementById('addOverlay');
const addOvInput = document.getElementById('addOvInput');
const addOvErr = document.getElementById('addOvErr');

function openAddOverlay() {
  addOvInput.value = '';
  addOvErr.classList.remove('show');
  addOverlay.classList.add('show');
  setTimeout(() => addOvInput.focus(), 80);
}
function closeAddOverlay() {
  addOverlay.classList.remove('show');
}
document.getElementById('addCodeBtn').addEventListener('click', openAddOverlay);
document.getElementById('addOvCancel').addEventListener('click', closeAddOverlay);
addOverlay.addEventListener('click', e => { if (e.target === addOverlay) closeAddOverlay(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && addOverlay.classList.contains('show')) closeAddOverlay();
});
document.getElementById('addOvSubmit').addEventListener('click', submitAddCode);
addOvInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAddCode(); });
addOvInput.addEventListener('input', () => {
  addOvInput.value = addOvInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  addOvErr.classList.remove('show');
});

function submitAddCode() {
  const raw = addOvInput.value.trim().toUpperCase();
  // Accept with or without "CH-" prefix
  const code = raw.startsWith('CH-') ? raw : 'CH-' + raw;
  if (!/^CH-[A-Z0-9]{6,10}$/.test(code)) {
    addOvErr.classList.add('show');
    return;
  }
  closeAddOverlay();
  goDetail(code);
}

// ===== PWA INSTALL BANNER =====
let _pwaPrompt = null;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  showInstallBanner('native');
});
window.addEventListener('appinstalled', () => {
  _pwaPrompt = null;
  const b = document.getElementById('install-bar');
  if (b) b.remove();
});

function showInstallBanner(type) {
  if (isStandalone) return;
  let existing = document.getElementById('install-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'install-bar';
  if (type === 'native') {
    bar.innerHTML = `
      <div class="ib-text"><strong>Installer Chaskis</strong><span>Accès rapide au suivi depuis l'écran d'accueil</span></div>
      <button class="ib-btn" onclick="doNativeInstall()">Installer</button>
      <button class="ib-close" onclick="this.parentElement.remove()">&times;</button>`;
  } else {
    const hint = isIOS
      ? 'Appuyez sur <strong>Partager ↑</strong> puis <strong>"Sur l\'écran d\'accueil"</strong>'
      : 'Appuyez sur <strong>⋮</strong> puis <strong>"Ajouter à l\'écran d\'accueil"</strong>';
    bar.innerHTML = `
      <div class="ib-text"><strong>Ajouter Chaskis à l'écran d'accueil</strong><span>${hint}</span></div>
      <button class="ib-close" onclick="this.parentElement.remove()">&times;</button>`;
  }
  document.body.prepend(bar);
}
function doNativeInstall() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(() => {
    _pwaPrompt = null;
    const b = document.getElementById('install-bar');
    if (b) b.remove();
  });
}
if (!isStandalone) {
  setTimeout(() => { if (!_pwaPrompt) showInstallBanner('manual'); }, 3000);
}

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ===== BOOT =====
// Refresh the list/detail every 30s so the mocked status progresses while the tab is open.
render();
setInterval(() => {
  // Only re-render if we're on the detail screen or the list with active orders.
  const code = currentCode();
  if (code) render();
  else {
    const orders = loadOrders();
    if (orders.some(o => deriveStatus(o) !== 'delivered')) render();
  }
}, 30000);

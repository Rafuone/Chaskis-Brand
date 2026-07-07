/* Chaskis — dashboard.js (ex-inline de dashboard.html) */
// Service Worker : enregistré par shared.js (opt-in via data-sw sur <html>).

// ===== POD MODAL =====
function openPod(orderId, courier, eta) {
  document.getElementById('podOrderMeta').textContent = orderId + ' · ' + courier;
  document.getElementById('podTime').textContent = eta || '14h27';
  document.getElementById('podCourier').textContent = courier.split(' ')[0];
  document.getElementById('podRef').textContent = orderId;
  switchPodTab('photo', document.querySelector('.pod-tab'));
  document.getElementById('podOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closePod() {
  document.getElementById('podOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function switchPodTab(tab, el) {
  document.querySelectorAll('.pod-tab').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  document.getElementById('podPhoto').style.display = tab === 'photo' ? 'block' : 'none';
  document.getElementById('podSig').style.display = tab === 'sig' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!user) {
    document.getElementById('dashGuard').style.display = 'block';
    return;
  }
  document.getElementById('dashContent').style.display = 'block';
  const orders = getUserOrders();
  const activeOrders = orders.filter(o => o.status === 'en_cours');
  const deliveredOrders = orders.filter(o => o.status === 'livre');
  const totalSpent = orders.filter(o => o.status !== 'annule').reduce((s, o) => s + o.price, 0);

  // Sidebar
  document.getElementById('dashAvatar').style.background = getPlanColor(user.plan);
  document.getElementById('dashAvatar').textContent = getInitials(user.name);
  document.getElementById('dashName').textContent = user.name;
  document.getElementById('dashCompany').textContent = user.company;
  const planEl = document.getElementById('dashPlan');
  planEl.textContent = getPlanLabel(user.plan);
  planEl.style.background = getPlanColor(user.plan) + '20';
  planEl.style.color = getPlanColor(user.plan);

  // Section switching
  document.querySelectorAll('#dashNav a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('#dashNav a').forEach(x => x.classList.remove('on'));
      a.classList.add('on');
      document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('on'));
      document.getElementById('sec-' + a.dataset.sec).classList.add('on');
    });
  });

  // ===== OVERVIEW =====
  document.getElementById('welcomeMsg').textContent = `Bonjour, ${user.name.split(' ')[0]}`;
  document.getElementById('welcomeSub').textContent = `${user.company} · Plan ${getPlanLabel(user.plan)}`;

  document.getElementById('overviewStats').innerHTML = `
    <div class="dash-stat"><strong style="color:var(--teal)">${orders.filter(o => o.date >= '2026-04-01').length}</strong><span>Livraisons ce mois</span></div>
    <div class="dash-stat"><strong style="color:var(--yellow)">CHF ${totalSpent}</strong><span>Dépenses totales</span></div>
    <div class="dash-stat"><strong style="color:var(--purple)">98%</strong><span>Ponctualité</span></div>
    <div class="dash-stat"><strong style="color:var(--teal)">${activeOrders.length > 0 ? activeOrders[0].eta || 'Auj.' : 'Aucune'}</strong><span>Prochaine livraison</span></div>
  `;

  // Recent orders (last 3)
  const recent = orders.slice(0, 3);
  document.getElementById('recentOrders').innerHTML = recent.map(o => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.04);font-size:.82rem">
      <div><strong style="color:var(--ink)">${o.id}</strong> <span style="color:var(--ink-muted);margin-left:8px">${o.date}</span></div>
      <div style="display:flex;align-items:center;gap:12px">
        <span class="dash-status" style="background:${getStatusColor(o.status)}20;color:${getStatusColor(o.status)}">${getStatusLabel(o.status)}</span>
        <strong>CHF ${o.price}</strong>
      </div>
    </div>
  `).join('');

  // Upgrade CTA
  const upgradeEl = document.getElementById('upgradeCard');
  if (user.plan === 'express') {
    upgradeEl.innerHTML = `<div class="dash-upgrade"><div><h4>Passez au Pro</h4><p>Réservez un appel découverte pour accéder aux tarifs Flex (CHF 10) ou Dédié (CHF 8).</p></div><a href="index.html#booking" class="btn btn-w btn-sm"><span>Planifier un appel gratuit</span></a></div>`;
  } else if (user.plan === 'flex') {
    upgradeEl.innerHTML = `<div class="dash-upgrade"><div><h4>Passez au Dédié : CHF 8/course</h4><p>Flotte dédiée à votre marque, account manager et SLA garanti.</p></div><a href="index.html#booking" class="btn btn-w btn-sm"><span>Prendre rendez-vous</span></a></div>`;
  } else {
    upgradeEl.innerHTML = `<div class="dash-upgrade" style="background:linear-gradient(135deg,var(--purple),var(--purple-light))"><div><h4>Plan Dédié actif</h4><p>Votre flotte dédiée est opérationnelle. Merci pour votre confiance.</p></div><span class="btn btn-w btn-sm" style="pointer-events:none;opacity:.7"><span>Actif</span></span></div>`;
  }

  // ===== ORDERS =====
  window.renderOrders = function() {
    const filter = document.getElementById('orderFilter').value;
    const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
    document.getElementById('ordersBody').innerHTML = filtered.map(o => `
      <tr>
        <td class="td-id">${o.id}</td>
        <td>${o.date}</td>
        <td class="td-route">${o.from.split(',')[0]} <small>→ ${o.to.split(',')[0]}</small></td>
        <td>${o.courier}</td>
        <td><span class="dash-status" style="background:${getStatusColor(o.status)}20;color:${getStatusColor(o.status)}">${getStatusLabel(o.status)}</span></td>
        <td><strong>CHF ${o.price}</strong></td>
        <td>${o.status === 'livre' ? `<button onclick="openPod('${o.id}','${o.courier}','')" style="font-size:.68rem;font-weight:700;color:var(--accent);background:var(--accent-bg);padding:3px 10px;border-radius:var(--pill);border:none;cursor:pointer;font-family:inherit;white-space:nowrap">POD</button>` : ''}</td>
      </tr>
    `).join('');
    if (filtered.length === 0) {
      document.getElementById('ordersBody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-muted)">Aucune commande trouvée</td></tr>';
    }
  };
  renderOrders();

  // ===== ACTIVE DELIVERIES =====
  const activeEl = document.getElementById('activeDeliveries');
  const stepIcons = [
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
  ];
  const stepLabels = ['Confirmée', 'Prise en charge', 'En route', 'Livrée'];

  if (activeOrders.length === 0) {
    activeEl.innerHTML = `<div class="dash-card" style="text-align:center;padding:48px 24px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--sand);margin:0 auto 12px"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      <p style="font-size:.88rem;color:var(--ink-muted)">Aucune livraison en cours</p>
      <a href="commander.html" class="btn btn-p btn-sm" style="margin-top:16px"><span>Commander</span></a>
    </div>`;
  } else {
    activeEl.innerHTML = activeOrders.map((o, i) => {
      const step = i === 0 ? 2 : 1;
      const initials = o.courier.split(' ').map(w => w[0]).join('').slice(0,2);

      return `
        <div class="dash-card track-card">
          <!-- En-tête -->
          <div class="track-head">
            <div>
              <span class="track-title">${o.id}</span>
              <span class="track-status-badge" style="background:${getStatusColor('en_cours')}20;color:${getStatusColor('en_cours')}">En cours</span>
            </div>
            <div class="track-eta-box">
              <span class="eta-l">ETA</span>
              <strong>${o.eta || '~45 min'}</strong>
            </div>
          </div>

          <!-- Coursier -->
          <div class="track-courier">
            <div class="track-cav">${initials}</div>
            <div class="track-cinfo">
              <strong>${o.courier}</strong>
              <span>${step >= 2 ? 'En route vers la destination' : 'Se dirige vers le point de retrait'}</span>
            </div>
            <a href="tel:+41791234567" class="track-call" title="Appeler le coursier">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 10.81 19.79 19.79 0 01.21 2.22 2 2 0 012.22 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
            </a>
          </div>

          <!-- Route visuelle -->
          <div class="track-route">
            <div class="track-point">
              <div class="tp-dot pick"></div>
              <div class="tp-info"><span class="tp-l">Retrait</span><span class="tp-a">${o.from}</span></div>
            </div>
            <div class="track-route-line">
              <div class="trl-stick"></div>
              <span class="trl-rider">${step >= 2 ? '🚴' : '🏪'}</span>
            </div>
            <div class="track-point">
              <div class="tp-dot drop"></div>
              <div class="tp-info"><span class="tp-l">Livraison</span><span class="tp-a">${o.to}</span></div>
            </div>
          </div>

          <!-- Timeline statuts -->
          <div class="track-tl">
            ${stepLabels.map((s, si) => `
              ${si > 0 ? `<div class="tt-conn ${si <= step ? 'done' : ''}"></div>` : ''}
              <div class="tt-step ${si < step ? 'done' : si === step ? 'active' : ''}">
                <div class="tt-dot">${stepIcons[si]}</div>
                <span class="tt-label">${s}</span>
              </div>
            `).join('')}
          </div>

          <!-- POD / actions -->
          <div class="track-pod-bar">
            <span class="pod-note">Suivi GPS actif · SMS envoyé au destinataire</span>
            <button class="pod-btn" onclick="openPod('${o.id}','${o.courier}','${o.eta||''}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="16 13 12 17 8 13"/><line x1="12" y1="17" x2="12" y2="9"/></svg>
              Preuve de livraison
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ===== ACCOUNT =====
  document.getElementById('accountInfo').innerHTML = `
    <div class="dash-account-field"><span class="daf-label">Nom</span><span class="daf-value">${user.name}</span></div>
    <div class="dash-account-field"><span class="daf-label">Email</span><span class="daf-value">${user.email}</span></div>
    <div class="dash-account-field"><span class="daf-label">Société</span><span class="daf-value">${user.company}</span></div>
    <div class="dash-account-field"><span class="daf-label">Ville</span><span class="daf-value">${user.city}</span></div>
    <div class="dash-account-field"><span class="daf-label">Plan actuel</span><span class="daf-value"><span class="dash-plan" style="background:${getPlanColor(user.plan)}20;color:${getPlanColor(user.plan)}">${getPlanLabel(user.plan)}</span></span></div>
    <div class="dash-account-field"><span class="daf-label">Tarif / course</span><span class="daf-value" style="font-weight:800;color:var(--teal)">CHF ${{express:16,flex:10,dedie:8}[user.plan]}</span></div>
  `;

  // ===== BILLING =====
  const monthOrders = orders.filter(o => o.date >= '2026-04-01' && o.status !== 'annule');
  const monthTotal = monthOrders.reduce((s, o) => s + o.price, 0);
  document.getElementById('billingSummary').innerHTML = `
    <div class="dash-stat"><strong style="color:var(--teal)">CHF ${monthTotal}</strong><span>Avril 2026</span></div>
    <div class="dash-stat"><strong style="color:var(--ink)">${monthOrders.length}</strong><span>Livraisons ce mois</span></div>
  `;

  const invoices = [
    { num: 'INV-2026-04', date: 'Avril 2026', amount: monthTotal, status: 'En attente' },
    { num: 'INV-2026-03', date: 'Mars 2026', amount: Math.round(totalSpent * 0.7), status: 'Payée' },
    { num: 'INV-2026-02', date: 'Février 2026', amount: Math.round(totalSpent * 0.5), status: 'Payée' },
  ];
  document.getElementById('invoiceList').innerHTML = invoices.map(inv => `
    <div class="dash-invoice">
      <div class="dash-inv-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="dash-inv-info"><strong>${inv.num}</strong><span>${inv.date}</span></div>
      <span class="dash-status" style="background:${inv.status === 'Payée' ? '#2A8A8520' : '#F5B80020'};color:${inv.status === 'Payée' ? '#2A8A85' : '#8a7000'}">${inv.status}</span>
      <div class="dash-inv-amount">CHF ${inv.amount}</div>
    </div>
  `).join('');
});

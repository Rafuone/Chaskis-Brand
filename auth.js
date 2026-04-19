// ===== CHASKIS AUTH SYSTEM =====
// Demo auth with localStorage. Self-bootstrapping on every page.

const DEMO_ACCOUNTS = [
  { email: 'demo@chaskis.ch', password: 'demo', name: 'Jean Dupont', company: 'Le Central', plan: 'express', city: 'Lausanne' },
  { email: 'flex@chaskis.ch', password: 'flex', name: 'Marie Laurent', company: 'Pharmacie du Lac', plan: 'flex', city: 'Genève' },
  { email: 'dedie@chaskis.ch', password: 'dedie', name: 'Pierre Morel', company: 'Swiss E-Shop', plan: 'dedie', city: 'Neuchâtel' }
];

const STORAGE_KEY = 'chaskis_user';

// Demo order data per plan
const DEMO_ORDERS = {
  express: [
    { id: 'CK-41023', date: '2026-04-02', from: 'Rue du Pont 12, Lausanne', to: 'Avenue de Cour 45, Lausanne', status: 'livre', price: 16, courier: 'Marco R.' },
    { id: 'CK-39871', date: '2026-03-18', from: 'Place St-François, Lausanne', to: 'Chemin de Mornex 6, Lausanne', status: 'livre', price: 16, courier: 'Sophie B.' },
    { id: 'CK-38102', date: '2026-03-05', from: 'Rue de Bourg 8, Lausanne', to: 'Avenue de Rhodanie 2, Lausanne', status: 'annule', price: 16, courier: '-' },
  ],
  flex: [
    { id: 'CK-42150', date: '2026-04-07', from: 'Rue du Mont-Blanc 8, Genève', to: 'Rue de la Servette 12, Genève', status: 'en_cours', price: 10, courier: 'Ahmed K.', eta: '14:25' },
    { id: 'CK-41890', date: '2026-04-05', from: 'Quai Wilson 3, Genève', to: 'Rue de Carouge 20, Genève', status: 'livre', price: 10, courier: 'Julie M.' },
    { id: 'CK-41502', date: '2026-04-03', from: 'Rue du Rhône 42, Genève', to: 'Boulevard Carl-Vogt 8, Genève', status: 'livre', price: 10, courier: 'Marco R.' },
    { id: 'CK-41100', date: '2026-04-01', from: 'Place Bel-Air, Genève', to: 'Rue de Lausanne 15, Genève', status: 'livre', price: 10, courier: 'Sophie B.' },
    { id: 'CK-40320', date: '2026-03-28', from: 'Rue du Mont-Blanc 8, Genève', to: 'Avenue Pictet-de-Rochemont 4, Genève', status: 'livre', price: 10, courier: 'Ahmed K.' },
    { id: 'CK-39800', date: '2026-03-22', from: 'Rue de la Croix-d\'Or 7, Genève', to: 'Rue de Carouge 40, Genève', status: 'livre', price: 10, courier: 'Julie M.' },
    { id: 'CK-39210', date: '2026-03-15', from: 'Quai du Mont-Blanc 19, Genève', to: 'Boulevard de Saint-Georges 6, Genève', status: 'annule', price: 10, courier: '-' },
    { id: 'CK-38700', date: '2026-03-08', from: 'Place Cornavin 2, Genève', to: 'Rue de la Servette 45, Genève', status: 'livre', price: 10, courier: 'Marco R.' },
  ],
  dedie: [
    { id: 'CK-42301', date: '2026-04-07', from: 'Rue du Seyon 12, Neuchâtel', to: 'Rue de la Treille 4, Neuchâtel', status: 'en_cours', price: 8, courier: 'Thomas L.', eta: '13:50' },
    { id: 'CK-42289', date: '2026-04-07', from: 'Faubourg du Lac 5, Neuchâtel', to: 'Rue des Beaux-Arts 2, Neuchâtel', status: 'en_cours', price: 8, courier: 'Lisa G.', eta: '14:10' },
    { id: 'CK-42100', date: '2026-04-06', from: 'Avenue de la Gare 8, Neuchâtel', to: 'Rue du Château 1, Neuchâtel', status: 'livre', price: 8, courier: 'Thomas L.' },
    { id: 'CK-41950', date: '2026-04-05', from: 'Rue du Seyon 12, Neuchâtel', to: 'Quai Philippe-Godet 6, Neuchâtel', status: 'livre', price: 8, courier: 'Lisa G.' },
    { id: 'CK-41800', date: '2026-04-04', from: 'Faubourg du Lac 5, Neuchâtel', to: 'Rue de l\'Hôpital 10, Neuchâtel', status: 'livre', price: 8, courier: 'Thomas L.' },
    { id: 'CK-41650', date: '2026-04-03', from: 'Avenue de la Gare 8, Neuchâtel', to: 'Rue des Moulins 3, Neuchâtel', status: 'livre', price: 8, courier: 'Lisa G.' },
    { id: 'CK-41480', date: '2026-04-02', from: 'Rue du Seyon 12, Neuchâtel', to: 'Rue de la Treille 4, Neuchâtel', status: 'livre', price: 8, courier: 'Thomas L.' },
    { id: 'CK-41300', date: '2026-04-01', from: 'Faubourg du Lac 5, Neuchâtel', to: 'Quai Robert-Comtesse 2, Neuchâtel', status: 'livre', price: 8, courier: 'Lisa G.' },
    { id: 'CK-41100', date: '2026-03-31', from: 'Rue du Seyon 12, Neuchâtel', to: 'Rue des Beaux-Arts 2, Neuchâtel', status: 'livre', price: 8, courier: 'Thomas L.' },
    { id: 'CK-40900', date: '2026-03-29', from: 'Avenue de la Gare 8, Neuchâtel', to: 'Boulevard de la Gare 12, Neuchâtel', status: 'livre', price: 8, courier: 'Lisa G.' },
    { id: 'CK-40700', date: '2026-03-27', from: 'Faubourg du Lac 5, Neuchâtel', to: 'Rue du Château 1, Neuchâtel', status: 'annule', price: 8, courier: '-' },
    { id: 'CK-40500', date: '2026-03-25', from: 'Rue du Seyon 12, Neuchâtel', to: 'Rue de l\'Hôpital 10, Neuchâtel', status: 'livre', price: 8, courier: 'Thomas L.' },
    { id: 'CK-40300', date: '2026-03-22', from: 'Avenue de la Gare 8, Neuchâtel', to: 'Quai Philippe-Godet 6, Neuchâtel', status: 'livre', price: 8, courier: 'Lisa G.' },
    { id: 'CK-40100', date: '2026-03-18', from: 'Faubourg du Lac 5, Neuchâtel', to: 'Rue des Moulins 3, Neuchâtel', status: 'livre', price: 8, courier: 'Thomas L.' },
    { id: 'CK-39900', date: '2026-03-14', from: 'Rue du Seyon 12, Neuchâtel', to: 'Rue de la Treille 4, Neuchâtel', status: 'livre', price: 8, courier: 'Lisa G.' },
  ]
};

// ===== CORE AUTH =====
function getUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
function isLoggedIn() { return !!getUser(); }
function getUserTier() { const u = getUser(); return u ? u.plan : 'express'; }
function getUserOrders() { return DEMO_ORDERS[getUserTier()] || DEMO_ORDERS.express; }

function login(email, password) {
  const account = DEMO_ACCOUNTS.find(a => a.email === email && a.password === password);
  if (!account) return false;
  const { password: _, ...userData } = account;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  return true;
}
function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function getPlanLabel(plan) {
  return { express: 'Express', flex: 'Flex', dedie: 'Dédié' }[plan] || 'Express';
}
function getPlanColor(plan) {
  return { express: 'var(--yellow)', flex: 'var(--teal)', dedie: 'var(--purple)' }[plan] || 'var(--yellow)';
}
function getStatusLabel(s) {
  return { livre: 'Livré', en_cours: 'En cours', annule: 'Annulé' }[s] || s;
}
function getStatusColor(s) {
  return { livre: '#2A8A85', en_cours: '#3AAFA9', annule: '#9EA69F' }[s] || '#9EA69F';
}

// ===== LOGIN MODAL =====
function injectLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'loginModal';
  modal.className = 'login-overlay';
  modal.innerHTML = `
    <div class="login-card">
      <button class="login-close" onclick="closeLoginModal()" aria-label="Fermer">&times;</button>
      <h2 class="login-title">Connexion</h2>
      <p class="login-sub">Accédez à vos tarifs Pro et votre tableau de bord</p>
      <div class="login-form">
        <div class="login-field"><label>Email</label><input type="email" id="loginEmail" placeholder="votre@email.ch"></div>
        <div class="login-field"><label>Mot de passe</label><input type="password" id="loginPass" placeholder="••••••"></div>
        <div class="login-error" id="loginError">Email ou mot de passe incorrect</div>
        <button class="login-submit" onclick="handleLogin()">Se connecter</button>
      </div>
      <div class="login-demo">
        <p class="login-demo-title">Comptes de démonstration</p>
        <div class="login-demo-accounts">
          <div class="login-demo-account" onclick="fillDemo('demo@chaskis.ch','demo')">
            <span class="lda-badge" style="background:var(--yellow-bg);color:#8a7000">Express</span>
            <span class="lda-email">demo@chaskis.ch</span>
          </div>
          <div class="login-demo-account" onclick="fillDemo('flex@chaskis.ch','flex')">
            <span class="lda-badge" style="background:var(--teal-bg);color:var(--teal-dark)">Flex</span>
            <span class="lda-email">flex@chaskis.ch</span>
          </div>
          <div class="login-demo-account" onclick="fillDemo('dedie@chaskis.ch','dedie')">
            <span class="lda-badge" style="background:var(--purple-bg);color:var(--purple)">Dédié</span>
            <span class="lda-email">dedie@chaskis.ch</span>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close on overlay click
  modal.addEventListener('click', e => { if (e.target === modal) closeLoginModal(); });
  // Close on ESC
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLoginModal(); });
  // Enter to submit
  ['loginEmail', 'loginPass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });
}

function openLoginModal() {
  const m = document.getElementById('loginModal');
  if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; }
}
function closeLoginModal() {
  const m = document.getElementById('loginModal');
  if (m) { m.classList.remove('show'); document.body.style.overflow = ''; }
  const err = document.getElementById('loginError');
  if (err) err.style.display = 'none';
}
function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (login(email, pass)) {
    closeLoginModal();
    window.location.reload();
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
}
function fillDemo(email, pass) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPass').value = pass;
  document.getElementById('loginError').style.display = 'none';
}

// ===== NAV STATE =====
function updateNavState() {
  const user = getUser();
  const loginEl = document.querySelector('.nav-login');
  if (!loginEl) return;

  if (user) {
    // Replace login button with user avatar + dropdown
    loginEl.outerHTML = `
      <div class="nav-user" id="navUser">
        <div class="nav-user-av" style="background:${getPlanColor(user.plan)}">${getInitials(user.name)}</div>
        <span class="nav-user-name">${user.name.split(' ')[0]}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        <div class="nav-user-dd" id="navDD">
          <div class="ndd-user">
            <strong>${user.name}</strong>
            <span>${user.company}</span>
            <span class="ndd-plan" style="background:${getPlanColor(user.plan)}20;color:${getPlanColor(user.plan)}">${getPlanLabel(user.plan)}</span>
          </div>
          <a href="dashboard.html" class="ndd-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Tableau de bord</a>
          <a href="commander.html" class="ndd-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Nouvelle commande</a>
          <div class="ndd-sep"></div>
          <a href="#" class="ndd-link ndd-logout" onclick="logout();return false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>Déconnexion</a>
        </div>
      </div>
    `;
    // Toggle dropdown
    const navUser = document.getElementById('navUser');
    const dd = document.getElementById('navDD');
    if (navUser && dd) {
      navUser.addEventListener('click', e => {
        e.stopPropagation();
        dd.classList.toggle('show');
      });
      document.addEventListener('click', () => dd.classList.remove('show'));
    }

    // Update mobile menu
    const mm = document.getElementById('mm');
    if (mm) {
      const links = mm.querySelectorAll('a');
      links.forEach(a => {
        if (a.textContent.includes('Connexion')) {
          a.href = 'dashboard.html';
          a.textContent = 'Tableau de bord';
          a.removeAttribute('onclick');
        }
      });
      // Add logout link if not present
      if (!mm.querySelector('.mm-logout')) {
        const logoutLink = document.createElement('a');
        logoutLink.href = '#';
        logoutLink.className = 'mm-logout';
        logoutLink.textContent = 'Déconnexion';
        logoutLink.onclick = e => { e.preventDefault(); logout(); };
        mm.appendChild(logoutLink);
      }
    }
  } else {
    // Not logged in: intercept login click
    loginEl.addEventListener('click', e => {
      e.preventDefault();
      openLoginModal();
    });
  }
}

// ===== COMMANDER: TIER GATING =====
function updateTierGating() {
  const tierBar = document.getElementById('tierBar');
  if (!tierBar) return; // Not on commander page

  const user = getUser();
  if (user) {
    const plan = user.plan;
    // Update subtitle
    const sub = document.querySelector('.ostep-sub');
    if (sub && document.getElementById('os0')) {
      sub.textContent = `Connecté en tant que ${user.name} · Plan ${getPlanLabel(plan)}`;
    }
    // Unlock tiers based on plan
    if (plan === 'flex' || plan === 'dedie') {
      const flexTier = tierBar.querySelector('[data-tier="flex"]');
      if (flexTier) {
        flexTier.classList.remove('lk');
        const tag = flexTier.querySelector('.tier-tag');
        if (tag) tag.remove();
        flexTier.addEventListener('click', () => selectTier(flexTier));
      }
    }
    if (plan === 'dedie') {
      const dedieTier = tierBar.querySelector('[data-tier="dedie"]');
      if (dedieTier) {
        dedieTier.classList.remove('lk');
        const tag = dedieTier.querySelector('.tier-tag');
        if (tag) tag.remove();
        dedieTier.addEventListener('click', () => selectTier(dedieTier));
      }
      // Auto-select dedie
      tierBar.querySelectorAll('.tier').forEach(t => t.classList.remove('on'));
      const dt = tierBar.querySelector('[data-tier="dedie"]');
      if (dt) { dt.classList.add('on'); }
      if (typeof tierName !== 'undefined') { tierName = 'Dédié'; tierPrice = 8; }
    }
  } else {
    // Not logged in: add info banner
    const existingBanner = document.querySelector('.tier-guest-banner');
    if (!existingBanner) {
      const banner = document.createElement('div');
      banner.className = 'tier-guest-banner';
      banner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Commandez sans compte en <strong>Express (CHF 16)</strong>. <a href="#" onclick="openLoginModal();return false" style="color:var(--teal);font-weight:700">Connectez-vous</a> pour les tarifs Pro.</span>
      `;
      tierBar.parentNode.insertBefore(banner, tierBar.nextSibling);
    }
  }
}

function selectTier(el) {
  const tierBar = document.getElementById('tierBar');
  tierBar.querySelectorAll('.tier').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  if (typeof tierName !== 'undefined') {
    tierName = el.querySelector('.tier-name').textContent;
    tierPrice = parseInt(el.dataset.price);
    if (typeof updateSum === 'function') updateSum();
  }
}

// ===== BOOTSTRAP =====
document.addEventListener('DOMContentLoaded', () => {
  injectLoginModal();
  updateNavState();
  updateTierGating();
});

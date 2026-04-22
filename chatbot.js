// ===== CHASKIS CHATBOT (démo) =====
// Widget flottant bottom-right, compartimenté par sujet (Livraison / Mobilité / Postuler / Contact).
// Réponses scriptées, volontairement prudentes : pas de chiffres précis, redirection vers simulateur / devis humain.

(function() {
  if (document.getElementById('chaskisChatbot')) return;

  const SCRIPT = {
    fr: {
      title: 'Assistant Chaskis',
      subtitle: 'Réponse en quelques secondes',
      openAria: 'Ouvrir le chat Chaskis',
      closeAria: 'Fermer le chat',
      backAria: 'Revenir aux catégories',
      placeholder: 'Posez votre question…',
      send: 'Envoyer',
      greeting: "Bonjour 👋 Je suis l'assistant Chaskis. Sur quel sujet puis-je vous aiguiller ?",
      backLabel: 'Retour aux thèmes',
      disclaimer: 'Assistant de démonstration · Réponses pré-enregistrées',
      fallback: "Je ne suis pas sûr de la réponse exacte. Pour une réponse précise, écrivez à <a href=\"mailto:hello@chaskis.ch\">hello@chaskis.ch</a>, appelez le <a href=\"tel:+41227000127\">+41 22 700 01 27</a>, ou <a href=\"index.html#booking\">réservez un appel</a>.",
      categories: [
        { id: 'livraison', label: 'Livraison', icon: 'truck', intro: "Livraison pour entreprises (Genève · Nyon · Lausanne · Riviera). Quelle question ?" },
        { id: 'mobilite', label: 'Mobilité', icon: 'car', intro: "Chauffeurs salariés et collecte prestige. Quelle info vous intéresse ?" },
        { id: 'postuler', label: 'Postuler', icon: 'user', intro: "Rejoindre les équipes (CDI, coursier ou chauffeur). Dites-moi ce qui vous freine ou vous intrigue." },
        { id: 'contact', label: 'Contact', icon: 'chat', intro: "Plusieurs canaux pour nous joindre." },
      ],
      topics: {
        livraison: [
          { q: 'Quels sont vos tarifs ?', a: "Les tarifs dépendent de la zone, du volume mensuel et du service choisi (Express, Flex ou Dédié). Un devis volumétrique est établi après échange. Pour une course ponctuelle, utilisez le <a href=\"commander.html\">simulateur</a> : vous voyez le prix exact avant de valider." },
          { q: 'Quelles zones couvrez-vous ?', a: "Quatre zones : <strong>Genève · Nyon · Lausanne · Riviera vaudoise</strong>. Les codes postaux exacts sont vérifiés dans le simulateur (certains NPA ne sont accessibles qu'en livraison, pas en collecte)." },
          { q: 'Quels sont vos délais ?', a: "En <strong>Super Express</strong>, nous garantissons une prise en charge sous 2 heures. En Express classique ou Flex, vous choisissez le créneau. Le délai exact est confirmé à la création de la course." },
          { q: 'Comment ça marche ?', a: "Trois offres : <strong>Express</strong> (ponctuel, à la carte), <strong>Flex</strong> (abonnement volume), <strong>Dédié</strong> (coursier attitré sur vos horaires). <a href=\"index.html#offres\">Voir les offres</a>." },
          { q: 'Intégration et API', a: "Nous nous intégrons aux outils courants (Shipday, Shopify, API REST sur demande). Pour un setup technique, <a href=\"index.html#booking\">réservez un appel</a>." },
          { q: 'Facturation', a: "Facturation mensuelle consolidée au nom de l'entreprise, TVA détaillée, export CSV compatible SAP / Sage / Bexio. Paiement par carte ou virement." },
        ],
        mobilite: [
          { q: 'Quels services Mobilité ?', a: "Deux services : <strong>transport de personnes</strong> (transferts aéroport, mise à disposition, événementiel, mobilité réduite, stations de ski) et <strong>collecte prestige</strong> (horlogerie, joaillerie, haute couture, grands crus). <a href=\"mobilite.html\">Tout voir</a>." },
          { q: 'Délai de réservation', a: "Les demandes classiques sont traitées dès 2 heures d'anticipation. Pour les trajets prestige ou événements, comptez 24 à 48 heures pour caler les détails." },
          { q: 'Flotte et chauffeurs', a: "Chauffeurs <strong>salariés en CDI</strong>, formés aux standards hôtels 5 étoiles. Berlines classe affaires et vans VIP, entretenus en atelier partenaire." },
          { q: 'Assurance objets de valeur', a: "Les missions prestige sont couvertes par une assurance spécifique jusqu'à plusieurs millions de CHF. Attestation fournie au départ, avec numéro de police." },
          { q: 'Annulation', a: "Annulation gratuite jusqu'à 4h avant pour le transport de personnes, 24h avant pour les missions prestige. Au-delà, une part du forfait reste due." },
        ],
        postuler: [
          { q: 'Permis requis', a: "Un <strong>permis de travail valable en Suisse</strong> est nécessaire (B, C, Ci sans condition ; UE/AELE avec permis valide ; L selon durée). Pour chauffeur : permis B ≥ 2 ans, B121 ou D1 selon mission, carte VTC à Genève." },
          { q: 'Combien on gagne ?', a: "Salaire horaire fixe conforme à la CCT, primes de performance et <strong>100% des pourboires reversés</strong>. La fourchette exacte est communiquée à l'entretien." },
          { q: 'Matériel à fournir', a: "<strong>Aucun.</strong> Coursiers : vélo, sac isotherme, veste et téléphone fournis dès J1. Chauffeurs : véhicule selon le poste ou frais remboursés." },
          { q: 'Horaires', a: "Planning mensuel construit avec vous. Compatible études, enfants, complément d'activité ou temps plein." },
          { q: 'Comment postuler', a: "Via l'app Chaskis : téléchargez, postulez en 2 min, notre équipe vous recontacte dans la semaine. <a href=\"postuler.html#download\">Commencer</a>." },
          { q: 'Frontaliers acceptés ?', a: "<strong>Oui.</strong> Les frontaliers sont bienvenus. Conditions standard CCT suisse." },
        ],
        contact: [
          { q: 'Email', a: "<a href=\"mailto:hello@chaskis.ch\">hello@chaskis.ch</a> pour la livraison. Pour la mobilité : <a href=\"mailto:mobilite@chaskis.ch\">mobilite@chaskis.ch</a>." },
          { q: 'Téléphone', a: "<a href=\"tel:+41227000127\">+41 22 700 01 27</a>, jours ouvrés." },
          { q: 'Adresses', a: "<strong>Genève</strong> : 69 rue des Vollandes, 1207. <strong>Lausanne</strong> : 22 ch. de Pierrefleur, 1004." },
          { q: 'Réserver un appel', a: "Pour un échange de 20 minutes sur vos besoins : <a href=\"index.html#booking\">choisir un créneau</a>." },
        ],
      },
      // Keywords pour fallback libre (si l'utilisateur tape au lieu de cliquer)
      keywords: [
        { kw: ['tarif','prix','coût','cout','combien'], a: "Les tarifs dépendent de la zone, du volume et du service. Pour un prix précis sur une course ponctuelle, <a href=\"commander.html\">utilisez le simulateur</a>. Pour un devis volumétrique : <a href=\"index.html#booking\">réserver un appel</a>." },
        { kw: ['délai','delai','express','rapide','vite','temps'], a: "Super Express = prise en charge sous 2h. Sinon vous choisissez le créneau lors de la création de la course." },
        { kw: ['postul','emploi','job','travail','rejoindre','équipe','equipe'], a: "Nous recrutons en CDI, coursiers et chauffeurs. <a href=\"postuler.html\">Voir les métiers</a> · <a href=\"postuler.html#download\">Postuler en 2 min via l'app</a>." },
        { kw: ['zone','couvre','couvert','ville','genève','geneve','lausanne','nyon','riviera'], a: "Couverture : Genève · Nyon · Lausanne · Riviera vaudoise. Certains codes postaux sont livraison uniquement (pas de collecte). <a href=\"commander.html\">Vérifier une adresse</a>." },
        { kw: ['mobilité','mobilite','vtc','transfert','aéroport','aeroport','chauffeur'], a: "Chaskis Mobilité = chauffeurs salariés + collecte prestige. <a href=\"mobilite.html\">Voir Mobilité</a>." },
        { kw: ['contact','humain','conseill','appel','téléphone','telephone','email','mail'], a: "<a href=\"tel:+41227000127\">+41 22 700 01 27</a> · <a href=\"mailto:hello@chaskis.ch\">hello@chaskis.ch</a> · <a href=\"index.html#booking\">réserver un appel</a>." },
        { kw: ['facture','tva','comptab','paiement'], a: "Facturation mensuelle consolidée, TVA détaillée, export CSV compatible SAP/Sage/Bexio. Paiement carte ou virement." },
        { kw: ['merci','thanks','thx','ok','super','parfait'], a: "Avec plaisir. Si besoin d'autre chose, je reste dispo." },
        { kw: ['bonjour','salut','hello','hi','hey','bonsoir'], a: "Bonjour 👋 Cliquez sur un thème ci-dessous, ou tapez votre question." },
      ],
    },
    en: {
      title: 'Chaskis Assistant',
      subtitle: 'Reply in a few seconds',
      openAria: 'Open Chaskis chat',
      closeAria: 'Close chat',
      backAria: 'Back to categories',
      placeholder: 'Ask your question…',
      send: 'Send',
      greeting: "Hi 👋 I'm the Chaskis assistant. Which topic can I help with?",
      backLabel: 'Back to topics',
      disclaimer: 'Demo assistant · Canned answers',
      fallback: "I'm not sure of the exact answer. For a precise reply, email <a href=\"mailto:hello@chaskis.ch\">hello@chaskis.ch</a>, call <a href=\"tel:+41227000127\">+41 22 700 01 27</a>, or <a href=\"index.html#booking\">book a call</a>.",
      categories: [
        { id: 'livraison', label: 'Delivery', icon: 'truck', intro: "Business delivery (Geneva · Nyon · Lausanne · Riviera). Your question?" },
        { id: 'mobilite', label: 'Mobility', icon: 'car', intro: "Salaried drivers and prestige pickup. What would you like to know?" },
        { id: 'postuler', label: 'Join us', icon: 'user', intro: "Joining the team (permanent contract, courier or driver). Ask me anything." },
        { id: 'contact', label: 'Contact', icon: 'chat', intro: "Several ways to reach us." },
      ],
      topics: {
        livraison: [
          { q: 'What are your rates?', a: "Rates depend on the zone, the monthly volume and the service (Express, Flex or Dedicated). A volume quote is set after a call. For one-off deliveries, use the <a href=\"commander.html\">simulator</a>: you see the exact price before confirming." },
          { q: 'Which zones?', a: "Four zones: <strong>Geneva · Nyon · Lausanne · Vaud Riviera</strong>. Exact postcodes are checked in the simulator (some are delivery-only, not pickup)." },
          { q: 'Delivery times', a: "In <strong>Super Express</strong>, we guarantee pickup within 2 hours. In standard Express or Flex, you pick the time slot. The exact timing is confirmed at order creation." },
          { q: 'How it works', a: "Three tiers: <strong>Express</strong> (one-off), <strong>Flex</strong> (volume subscription), <strong>Dedicated</strong> (assigned courier on your hours). <a href=\"index.html#offres\">See plans</a>." },
          { q: 'Integration and API', a: "We integrate with common tools (Shipday, Shopify, REST API on request). For a technical setup, <a href=\"index.html#booking\">book a call</a>." },
          { q: 'Invoicing', a: "Consolidated monthly invoicing in your company name, itemised VAT, CSV export compatible with SAP / Sage / Bexio. Payment by card or wire." },
        ],
        mobilite: [
          { q: 'Mobility services', a: "Two services: <strong>people transport</strong> (airport transfers, on-call, events, reduced mobility, ski resorts) and <strong>prestige pickup</strong> (watchmaking, jewellery, haute couture, fine wines). <a href=\"mobilite.html\">See all</a>." },
          { q: 'Booking notice', a: "Standard requests handled from 2 hours' notice. For prestige trips or events, plan 24 to 48 hours to calibrate details." },
          { q: 'Fleet and drivers', a: "<strong>Salaried, permanent-contract drivers</strong>, trained to 5-star hotel standards. Business-class sedans and VIP vans, serviced at partner workshops." },
          { q: 'Valuables insurance', a: "Prestige missions are covered by specific insurance up to several million CHF. Certificate provided at departure, with policy number." },
          { q: 'Cancellation', a: "Free cancellation up to 4 h before for people transport, 24 h before for prestige missions. Beyond that, a share of the flat rate remains due." },
        ],
        postuler: [
          { q: 'Required permits', a: "A <strong>valid Swiss work permit</strong> is required (B, C, Ci without conditions; EU/EFTA with valid permit; L depending on duration). For drivers: B licence ≥ 2 years, B121 or D1 depending on mission, VTC card in Geneva." },
          { q: 'How much do I earn?', a: "Fixed hourly salary compliant with the CCT, performance bonuses and <strong>100% of tips passed on</strong>. The exact range is shared at the interview." },
          { q: 'Gear to provide', a: "<strong>None.</strong> Couriers: bike, insulated bag, jacket and phone provided on day 1. Drivers: vehicle depending on the role or expenses reimbursed." },
          { q: 'Working hours', a: "Monthly schedule built with you. Compatible with studies, children, side income or full-time." },
          { q: 'How to apply', a: "Via the Chaskis app: download, apply in 2 min, our team gets back to you within the week. <a href=\"postuler.html#download\">Start</a>." },
          { q: 'Cross-border workers?', a: "<strong>Yes.</strong> Cross-border workers are welcome. Standard Swiss CCT conditions." },
        ],
        contact: [
          { q: 'Email', a: "<a href=\"mailto:hello@chaskis.ch\">hello@chaskis.ch</a> for delivery. For mobility: <a href=\"mailto:mobilite@chaskis.ch\">mobilite@chaskis.ch</a>." },
          { q: 'Phone', a: "<a href=\"tel:+41227000127\">+41 22 700 01 27</a>, business days." },
          { q: 'Addresses', a: "<strong>Geneva</strong>: 69 rue des Vollandes, 1207. <strong>Lausanne</strong>: 22 ch. de Pierrefleur, 1004." },
          { q: 'Book a call', a: "For a 20-minute chat about your needs: <a href=\"index.html#booking\">pick a slot</a>." },
        ],
      },
      keywords: [
        { kw: ['price','pricing','cost','rate','how much'], a: "Rates depend on the zone, volume and service tier. For an exact price on a one-off delivery, <a href=\"commander.html\">use the simulator</a>. For a volume quote: <a href=\"index.html#booking\">book a call</a>." },
        { kw: ['time','delay','fast','quick','express','how long'], a: "Super Express = pickup within 2 h. Otherwise you pick the time slot at order creation." },
        { kw: ['apply','job','work','hire','join','courier','driver'], a: "We hire on permanent contracts, couriers and drivers. <a href=\"postuler.html\">See the roles</a> · <a href=\"postuler.html#download\">Apply in 2 min via the app</a>." },
        { kw: ['zone','area','coverage','city','geneva','lausanne','nyon','riviera'], a: "Coverage: Geneva · Nyon · Lausanne · Vaud Riviera. Some postcodes are delivery-only (no pickup). <a href=\"commander.html\">Check an address</a>." },
        { kw: ['mobility','driver','chauffeur','transfer','airport'], a: "Chaskis Mobility = salaried drivers + prestige pickup. <a href=\"mobilite.html\">See Mobility</a>." },
        { kw: ['contact','human','advisor','call','phone','email'], a: "<a href=\"tel:+41227000127\">+41 22 700 01 27</a> · <a href=\"mailto:hello@chaskis.ch\">hello@chaskis.ch</a> · <a href=\"index.html#booking\">book a call</a>." },
        { kw: ['invoice','billing','vat','accounting','payment'], a: "Consolidated monthly invoicing, itemised VAT, CSV export for SAP/Sage/Bexio. Payment by card or wire." },
        { kw: ['thanks','thank','thx','ok','great','perfect'], a: "You're welcome. Ping me if you need anything else." },
        { kw: ['hello','hi','hey','good morning','good evening'], a: "Hi 👋 Pick a topic below, or type your question." },
      ],
    }
  };

  const ICONS = {
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="14" height="10" rx="1"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7" cy="14" r="1" fill="currentColor"/><circle cx="17" cy="14" r="1" fill="currentColor"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  };

  function t() {
    const lang = window._currentLang === 'en' ? 'en' : 'fr';
    return SCRIPT[lang];
  }

  // Build DOM
  const wrap = document.createElement('div');
  wrap.id = 'chaskisChatbot';
  wrap.className = 'chaskis-cb';
  wrap.innerHTML = `
    <button type="button" class="chaskis-cb-toggle" aria-label="${t().openAria}">
      <svg class="cb-ic-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
      <svg class="cb-ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
      <span class="chaskis-cb-pulse" aria-hidden="true"></span>
    </button>
    <div class="chaskis-cb-panel" role="dialog" aria-label="${t().title}" aria-hidden="true">
      <div class="chaskis-cb-head">
        <div class="chaskis-cb-ava" aria-hidden="true">${ICONS.chat}</div>
        <div class="chaskis-cb-head-txt">
          <strong class="chaskis-cb-title">${t().title}</strong>
          <span class="chaskis-cb-sub"><span class="chaskis-cb-dot"></span>${t().subtitle}</span>
        </div>
        <button type="button" class="chaskis-cb-x" aria-label="${t().closeAria}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="chaskis-cb-crumb" id="chaskisCbCrumb" hidden></div>
      <div class="chaskis-cb-body" id="chaskisCbBody"></div>
      <div class="chaskis-cb-sugg" id="chaskisCbSugg"></div>
      <form class="chaskis-cb-form" id="chaskisCbForm" autocomplete="off">
        <input type="text" class="chaskis-cb-input" id="chaskisCbInput" placeholder="${t().placeholder}" aria-label="${t().placeholder}">
        <button type="submit" class="chaskis-cb-send" aria-label="${t().send}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
        </button>
      </form>
      <div class="chaskis-cb-disclaimer">${t().disclaimer}</div>
    </div>
  `;
  document.body.appendChild(wrap);

  const toggle = wrap.querySelector('.chaskis-cb-toggle');
  const panel = wrap.querySelector('.chaskis-cb-panel');
  const closeBtn = wrap.querySelector('.chaskis-cb-x');
  const body = wrap.querySelector('#chaskisCbBody');
  const sugg = wrap.querySelector('#chaskisCbSugg');
  const crumb = wrap.querySelector('#chaskisCbCrumb');
  const form = wrap.querySelector('#chaskisCbForm');
  const input = wrap.querySelector('#chaskisCbInput');

  let opened = false;
  let hasGreeted = false;
  let currentCategory = null;

  function addMsg(html, from) {
    const row = document.createElement('div');
    row.className = 'chaskis-cb-row is-' + from;
    row.innerHTML = '<div class="chaskis-cb-bubble">' + html + '</div>';
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }

  function addTyping() {
    const row = document.createElement('div');
    row.className = 'chaskis-cb-row is-bot chaskis-cb-typing';
    row.innerHTML = '<div class="chaskis-cb-bubble"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span></div>';
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderCategories() {
    sugg.innerHTML = '';
    sugg.classList.remove('is-hidden','is-topics');
    sugg.classList.add('is-cats');
    t().categories.forEach(cat => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chaskis-cb-cat';
      b.innerHTML = '<span class="chaskis-cb-cat-ic">' + ICONS[cat.icon] + '</span><span class="chaskis-cb-cat-lbl">' + cat.label + '</span>';
      b.addEventListener('click', () => enterCategory(cat.id));
      sugg.appendChild(b);
    });
    crumb.hidden = true;
    crumb.innerHTML = '';
    currentCategory = null;
  }

  function renderTopicChips(catId) {
    const cat = t().categories.find(c => c.id === catId);
    const topics = t().topics[catId] || [];
    sugg.innerHTML = '';
    sugg.classList.remove('is-hidden','is-cats');
    sugg.classList.add('is-topics');
    topics.forEach(tp => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chaskis-cb-chip';
      b.textContent = tp.q;
      b.addEventListener('click', () => askTopic(catId, tp));
      sugg.appendChild(b);
    });
    crumb.hidden = false;
    crumb.innerHTML = '<button type="button" class="chaskis-cb-crumb-back" aria-label="' + t().backAria + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><span>' + t().backLabel + '</span></button><span class="chaskis-cb-crumb-cat">' + (cat ? cat.label : '') + '</span>';
    const back = crumb.querySelector('.chaskis-cb-crumb-back');
    back.addEventListener('click', () => {
      addMsg(t().greeting, 'bot');
      renderCategories();
    });
    currentCategory = catId;
  }

  function enterCategory(catId) {
    const cat = t().categories.find(c => c.id === catId);
    addMsg('<em>' + cat.label + '</em>', 'user');
    const typing = addTyping();
    setTimeout(() => {
      typing.remove();
      addMsg(cat.intro, 'bot');
      renderTopicChips(catId);
    }, 400);
  }

  function askTopic(catId, topic) {
    addMsg(escapeHtml(topic.q), 'user');
    const typing = addTyping();
    setTimeout(() => {
      typing.remove();
      addMsg(topic.a, 'bot');
    }, 500 + Math.random() * 300);
  }

  function answerFreeText(text) {
    const dict = t();
    const q = (text || '').toLowerCase().trim();
    if (!q) return null;
    // If we're in a category, prefer matching one of its topics first by keyword presence
    if (currentCategory && dict.topics[currentCategory]) {
      for (const tp of dict.topics[currentCategory]) {
        const words = tp.q.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (words.some(w => q.includes(w))) return tp.a;
      }
    }
    for (const rule of dict.keywords) {
      if (rule.kw.some(k => q.includes(k))) return rule.a;
    }
    return dict.fallback;
  }

  function handleUser(text) {
    const q = text.trim();
    if (!q) return;
    addMsg(escapeHtml(q), 'user');
    input.value = '';
    const typing = addTyping();
    const ans = answerFreeText(q);
    setTimeout(() => {
      typing.remove();
      addMsg(ans, 'bot');
    }, 550 + Math.random() * 400);
  }

  function open() {
    if (opened) return;
    opened = true;
    panel.setAttribute('aria-hidden', 'false');
    wrap.classList.add('is-open');
    if (!hasGreeted) {
      addMsg(t().greeting, 'bot');
      renderCategories();
      hasGreeted = true;
    }
    setTimeout(() => input.focus(), 260);
  }

  function close() {
    if (!opened) return;
    opened = false;
    panel.setAttribute('aria-hidden', 'true');
    wrap.classList.remove('is-open');
  }

  toggle.addEventListener('click', () => { opened ? close() : open(); });
  closeBtn.addEventListener('click', close);
  form.addEventListener('submit', e => { e.preventDefault(); handleUser(input.value); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && opened) close(); });

  // Re-translate on language change
  const origSetLang = window.__chaskisSetLang;
  if (typeof origSetLang === 'function') {
    window.__chaskisSetLang = function(lang) {
      origSetLang(lang);
      const dict = t();
      wrap.querySelector('.chaskis-cb-title').textContent = dict.title;
      wrap.querySelector('.chaskis-cb-sub').innerHTML = '<span class="chaskis-cb-dot"></span>' + dict.subtitle;
      toggle.setAttribute('aria-label', dict.openAria);
      closeBtn.setAttribute('aria-label', dict.closeAria);
      input.placeholder = dict.placeholder;
      input.setAttribute('aria-label', dict.placeholder);
      wrap.querySelector('.chaskis-cb-disclaimer').textContent = dict.disclaimer;
      if (hasGreeted && !body.querySelector('.chaskis-cb-row.is-user')) {
        body.innerHTML = '';
        addMsg(dict.greeting, 'bot');
        renderCategories();
      }
    };
  }
})();

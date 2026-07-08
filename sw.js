// SW passthrough, aucun cache, réseau pur.
// v2 : ne JAMAIS intercepter /api (Serverless Functions). Un fetch(e.request) sur une
// requête POST /api/publish ou /api/chat peut en altérer le mode/les credentials ou
// servir un comportement offline imprévisible. On laisse le réseau natif gérer /api.
// (Point transverse #2 : correctif posé une fois ici, acquis pour tous les chantiers.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', e => {
  let path = '';
  try { path = new URL(e.request.url).pathname; } catch (_) { /* URL non parsable : on passe au réseau */ }
  if (path === '/api' || path.startsWith('/api/')) return; // pas de respondWith => réseau natif
  e.respondWith(fetch(e.request));
});

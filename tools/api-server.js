// tools/api-server.js — serveur Node PORTABLE, SANS dépendance, sans build.
//
// Pourquoi : prouver que les Functions du dossier /api ne sont PAS couplées à Vercel.
// Elles tournent ici sur un simple serveur Node natif — donc aussi bien sur Azure App
// Service, un conteneur, ou n'importe quel hôte Node. C'est la base d'intégration côté
// hébergeur final (cible = Azure DevOps / Azure), et ça permet de tester /api en local
// (ce que tools/dev_server.py ne fait pas).
//
// Lancer :   node tools/api-server.js [port]
// Avec secrets (pour tester la publication) :
//   PUBLISH_SECRET=xxx GITHUB_TOKEN=xxx GITHUB_REPO=owner/repo GITHUB_BRANCH=main node tools/api-server.js 3100
//
// Les handlers /api utilisent la signature (req, res) Node brute et global fetch (Node 18+),
// exactement comme sur Vercel. AUCUNE réécriture nécessaire pour les faire tourner ici.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || process.argv[2] || 3100;

// Miroir des rewrites de vercel.json (URLs propres). À retranscrire côté hôte final
// (routes Express, staticwebapp.config.json, ou web.config) — c'est de la config, pas du code.
const REWRITES = {
  '/': '/index.html', '/app': '/app.html', '/commander': '/commander.html',
  '/dashboard': '/dashboard.html', '/postuler': '/postuler.html', '/mobilite': '/mobilite.html',
  '/admin': '/admin/editor.html', '/confidentialite': '/confidentialite.html',
  '/mentions-legales': '/mentions-legales.html', '/cgv': '/cgv.html',
};
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async function (req, res) {
  let pathname = '/';
  try { pathname = new URL(req.url, 'http://localhost').pathname; } catch (e) {}

  // --- /api/* : on appelle le handler du fichier api/<nom>.js, tel quel ---
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const name = pathname.replace(/^\/api\/?/, '').replace(/[^a-zA-Z0-9_-]/g, '');
    const file = path.join(ROOT, 'api', name + '.js');
    if (!name || !fs.existsSync(file)) {
      res.statusCode = 404; res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'endpoint /api/' + name + ' introuvable' })); return;
    }
    try {
      const handler = require(file);           // module.exports = (req, res) => ... (comme sur Vercel)
      await handler(req, res);
    } catch (e) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'erreur handler: ' + (e && e.message) }));
    }
    return;
  }

  // --- statique (avec rewrites d'URLs propres) ---
  const suivi = pathname.match(/^\/suivi\/([^/?#]+)\/?$/);
  if (suivi) pathname = '/app.html';
  if (REWRITES[pathname]) pathname = REWRITES[pathname];

  let filePath;
  try { filePath = path.join(ROOT, decodeURIComponent(pathname)); } catch (e) { filePath = path.join(ROOT, pathname); }
  if (!filePath.startsWith(ROOT)) { res.statusCode = 403; res.end('forbidden'); return; } // anti path-traversal

  fs.stat(filePath, function (err, st) {
    if (err || !st.isFile()) {
      res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('404 Not Found'); return;
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, function () {
  console.log('Chaskis — serveur Node portable (statique + /api) sur http://localhost:' + PORT);
  console.log('Aucune dépendance, aucun build. Base d\'intégration pour tout hôte Node (Azure App Service, conteneur, etc.).');
});

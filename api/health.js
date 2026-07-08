// api/health.js — Vercel Serverless Function, route publique GET /api/health.
//
// Convention Functions du projet (voir docs/schema/site-content.md) :
//   - CommonJS (module.exports), aucune dependance npm, aucun build, aucun package.json.
//   - Reponse en API Node brute (setHeader / statusCode / end) plutot que les helpers
//     res.status().json() de Vercel : ca marche a l'identique sur Vercel ET sur un
//     serveur Node/Express classique, donc portable vers vos propres serveurs plus tard.
//   - Chaque Function pose SON propre Cache-Control (rien n'est herite ; cf. point transverse #9).
//
// Sonde de sante : prouve que /api est operationnel en prod. no-store pour ne jamais
// etre mise en cache par le CDN ou le navigateur.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, service: 'chaskis', ts: new Date().toISOString() }));
};

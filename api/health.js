// api/health.js — Vercel Serverless Function, route publique GET /api/health.
//
// Convention Functions du projet (voir docs/schema/site-content.md) :
//   - CommonJS (module.exports), aucune dependance npm, aucun build, aucun package.json.
//   - Reponse en API Node brute (setHeader / statusCode / end) plutot que les helpers
//     res.status().json() de Vercel : ca marche a l'identique sur Vercel ET sur un
//     serveur Node/Express classique, donc portable vers vos propres serveurs plus tard.
//   - Chaque Function pose SON propre Cache-Control (rien n'est herite ; cf. point transverse #9).
//
// Deux roles (fusionnes pour rester sous la limite de fonctions du plan Vercel Hobby) :
//   - GET /api/health            => sonde de sante { ok, service, ts } (prouve que /api tourne).
//   - GET /api/health?probe=env  => { present:Boolean(PING_TOKEN) } : prouve qu'un secret cote
//     serveur est lu depuis les variables d'environnement SANS exposer sa valeur (patron de
//     securite de tous les tokens : ils vivent dans process.env, jamais dans le JS navigateur).
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  var url = (req && req.url) ? String(req.url) : '';
  if (/[?&]probe=env(&|$)/.test(url)) {
    res.end(JSON.stringify({ present: Boolean(process.env.PING_TOKEN) }));
    return;
  }
  res.end(JSON.stringify({ ok: true, service: 'chaskis', ts: new Date().toISOString() }));
};

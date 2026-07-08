// api/env-check.js — Vercel Serverless Function, route GET /api/env-check.
//
// Prouve qu'un secret cote serveur (PING_TOKEN) est bien lu depuis les variables
// d'environnement Vercel, SANS jamais exposer sa valeur : on ne renvoie qu'un booleen.
// C'est le patron de securite de tout le reste (GitHub, Calendly, LLM...) : un token
// vit uniquement dans process.env cote Function, jamais dans le JS servi au navigateur.
//
// { present:true }  => PING_TOKEN est defini dans cet environnement.
// { present:false } => variable absente (utile pour diagnostiquer un oubli sur Preview).
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify({ present: Boolean(process.env.PING_TOKEN) }));
};

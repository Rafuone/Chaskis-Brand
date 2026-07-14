// api/config.js — configuration PUBLIQUE du client (route GET /api/config).
//
// Expose UNIQUEMENT des valeurs publiques (aucun secret) dont le navigateur a besoin au
// démarrage — aujourd'hui la clé publishable Clerk, qui est faite pour vivre côté client.
// Permet de piloter l'auth par variable d'environnement, sans rien coder en dur dans le HTML
// (swap d'instance Clerk, ou bascule Entra plus tard, = changement d'env, pas de code).
//
// La clé publishable N'EST PAS un secret ; le secret Clerk (CLERK_SECRET_KEY) ne sort jamais
// du serveur et n'est PAS renvoyé ici.
'use strict';

var { send } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });
  send(res, 200, {
    clerkPublishableKey: (process.env.CLERK_PUBLISHABLE_KEY || '').trim(),
  });
};

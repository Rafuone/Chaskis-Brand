// api/_lib/auth.js — authentification partagée des Functions /api.
// Source UNIQUE de la comparaison de secret : constante en temps (aucune fuite de longueur).
'use strict';

const crypto = require('crypto');

// Comparaison en temps constant. On hache d'abord en SHA-256 (32 octets fixes) : timingSafeEqual
// exige des longueurs égales, et hacher évite de divulguer la longueur du secret par le timing
// (contrairement à un compare direct de Buffers de tailles différentes).
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a || ''), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b || ''), 'utf8').digest();
  try { return crypto.timingSafeEqual(ha, hb); } catch (e) { return false; }
}

// Vrai si l'en-tête `Authorization: Bearer <PUBLISH_SECRET>` correspond au secret d'environnement.
// Faux si le secret n'est pas configuré (pas d'auth ouverte par défaut).
function requireBearer(req) {
  const secret = (process.env.PUBLISH_SECRET || '').trim();
  if (!secret) return false;
  const bearer = (((req && req.headers) || {})['authorization'] || '').replace(/^Bearer\s+/i, '');
  return safeEqual(bearer, secret);
}

module.exports = { safeEqual, requireBearer };

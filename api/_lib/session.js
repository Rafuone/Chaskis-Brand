// api/_lib/session.js — authentification admin : session Clerk (JWT RS256) OU clé partagée.
//
// COUTURE (comme les autres chantiers) : activée seulement si CLERK_PUBLISHABLE_KEY est présent.
// - Avec Clerk : vérifie le jeton de session (Authorization: Bearer <jwt Clerk>) contre le JWKS
//   public de l'instance, en `crypto` NATIF (aucune dépendance npm, host-agnostique Azure).
// - Repli NON-CASSANT : la clé partagée PUBLISH_SECRET (Bearer) reste acceptée (break-glass).
//
// Contrôles de sécurité (revue dédiée) : alg épinglé RS256, kid requis + refetch JWKS sur
// rotation, signature RS256, exp REQUIS, nbf, iss en ÉGALITÉ STRICTE (pas « contient »),
// sub requis, azp validé contre une allow-list si configurée. Tolérance d'horloge 5 s
// (= clockSkewInMs par défaut de Clerk). Cible finale Entra ID = même schéma (JWKS + claims).
'use strict';

const crypto = require('crypto');
const { requireBearer } = require('./auth');

let _jwks = null, _jwksAt = 0;
const JWKS_TTL = 30 * 60 * 1000; // 30 min
const SKEW = 5;                  // tolérance d'horloge (s)

// Le domaine « frontend API » de l'instance Clerk est encodé dans la publishable key :
//   pk_<test|live>_<base64("<frontend-api>$")>. Dérivé à l'exécution (rien en dur).
function clerkFrontendApi() {
  const pk = (process.env.CLERK_PUBLISHABLE_KEY || '').trim();
  const m = pk.match(/^pk_(?:test|live)_(.+)$/);
  if (!m) return '';
  try { return Buffer.from(m[1], 'base64').toString('utf8').replace(/\$+$/, '').trim(); } catch (e) { return ''; }
}

// Origines autorisées pour le claim `azp` (défense CSRF en profondeur). Configurable par env
// (liste séparée par des virgules). Si NON configurée, on ne bloque pas sur azp (le transport
// Bearer est déjà immunisé CSRF, et on ne veut pas verrouiller par une allow-list oubliée).
function allowedOrigins() {
  return (process.env.CLERK_ALLOWED_ORIGINS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

async function getJwks(api, force) {
  const now = Date.now();
  if (!force && _jwks && (now - _jwksAt) < JWKS_TTL) return _jwks;
  try {
    const r = await fetch('https://' + api + '/.well-known/jwks.json');
    if (!r.ok) throw new Error('jwks ' + r.status);
    const j = await r.json();
    _jwks = (j && Array.isArray(j.keys)) ? j.keys : [];
    _jwksAt = now;
  } catch (e) {
    if (_jwks) return _jwks; // réseau KO mais cache présent -> on garde (anti-verrouillage)
    throw e;
  }
  return _jwks;
}

const B64URL = /^[A-Za-z0-9_-]+$/;
function b64urlToStr(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function b64urlToBuf(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }

// Vérifie un JWT de session Clerk (RS256). Renvoie le payload si valide, sinon null. Ne jette pas.
async function verifyClerkJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || !B64URL.test(parts[0]) || !B64URL.test(parts[1]) || !B64URL.test(parts[2])) return null;

    const header = JSON.parse(b64urlToStr(parts[0]));
    const payload = JSON.parse(b64urlToStr(parts[1]));
    if (header.alg !== 'RS256') return null;                 // algo épinglé (anti none/HS256)
    if (typeof header.kid !== 'string' || !header.kid) return null;

    const api = clerkFrontendApi();
    if (!api) return null;

    // kid : cherche dans le cache, refetch UNE fois si absent (rotation de clé)
    let keys = await getJwks(api, false);
    let jwk = keys.find(function (k) { return k.kid === header.kid; });
    if (!jwk) { keys = await getJwks(api, true); jwk = keys.find(function (k) { return k.kid === header.kid; }); }
    if (!jwk) return null;

    const pub = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    if (!crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), pub, b64urlToBuf(parts[2]))) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || now > payload.exp + SKEW) return null;   // exp REQUIS + expiré
    if (typeof payload.nbf === 'number' && now < payload.nbf - SKEW) return null;   // pas encore valide
    if (payload.iss !== 'https://' + api) return null;                             // ÉGALITÉ STRICTE
    if (!payload.sub) return null;                                                 // identifiant requis

    // azp : si présent ET une allow-list est configurée, il doit en faire partie.
    const azpOk = allowedOrigins();
    if (payload.azp && azpOk.length && azpOk.indexOf(payload.azp) < 0) return null;

    return payload;
  } catch (e) { return null; }
}

// Auth admin. true si : (1) Bearer == PUBLISH_SECRET (repli), OU (2) jeton de session Clerk valide.
async function requireAuth(req) {
  if (requireBearer(req)) return true; // rapide, sans réseau (break-glass / transition)
  const bearer = (((req && req.headers) || {})['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (bearer && bearer.split('.').length === 3 && (process.env.CLERK_PUBLISHABLE_KEY || '').trim()) {
    const payload = await verifyClerkJwt(bearer);
    if (payload) return true;
  }
  return false;
}

function _resetCache() { _jwks = null; _jwksAt = 0; }

module.exports = { requireAuth, verifyClerkJwt, clerkFrontendApi, _resetCache };

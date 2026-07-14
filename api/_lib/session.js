// api/_lib/session.js — authentification admin : session Clerk (JWT RS256) OU clé partagée.
//
// COUTURE (comme les autres chantiers) : activée seulement si CLERK_PUBLISHABLE_KEY est présent.
// - Avec Clerk : vérifie le jeton de session (Authorization: Bearer <jwt Clerk>) contre le JWKS
//   public de l'instance, en `crypto` NATIF (aucune dépendance npm, host-agnostique Azure).
// - Repli NON-CASSANT : la clé partagée PUBLISH_SECRET (Bearer) reste acceptée. Ainsi l'admin
//   n'est jamais verrouillé pendant la transition, et les appels serveur-à-serveur marchent.
//
// Cible finale = Entra ID / Azure AD B2C : même couture (vérif d'un JWT via JWKS) — on remplace
// l'URL du JWKS et l'issuer, la logique de vérification ne bouge pas.
'use strict';

const crypto = require('crypto');
const { requireBearer } = require('./auth');

let _jwks = null, _jwksAt = 0;
const JWKS_TTL = 60 * 60 * 1000; // 1 h

// Le domaine « frontend API » de l'instance Clerk est encodé dans la publishable key :
//   pk_<test|live>_<base64("<frontend-api>$")>. On le dérive à l'exécution (rien en dur).
function clerkFrontendApi() {
  const pk = (process.env.CLERK_PUBLISHABLE_KEY || '').trim();
  const m = pk.match(/^pk_(?:test|live)_(.+)$/);
  if (!m) return '';
  try { return Buffer.from(m[1], 'base64').toString('utf8').replace(/\$+$/, '').trim(); } catch (e) { return ''; }
}

async function getJwks(api) {
  const now = Date.now();
  if (_jwks && (now - _jwksAt) < JWKS_TTL) return _jwks;
  const r = await fetch('https://' + api + '/.well-known/jwks.json');
  if (!r.ok) throw new Error('jwks ' + r.status);
  const j = await r.json();
  _jwks = (j && Array.isArray(j.keys)) ? j.keys : [];
  _jwksAt = now;
  return _jwks;
}

function b64urlToStr(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function b64urlToBuf(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }

// Vérifie un JWT de session Clerk (RS256). Renvoie le payload si valide, sinon null. Ne jette pas.
async function verifyClerkJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(b64urlToStr(parts[0]));
    const payload = JSON.parse(b64urlToStr(parts[1]));
    if (header.alg !== 'RS256' || !header.kid) return null;

    const api = clerkFrontendApi();
    if (!api) return null;

    const keys = await getJwks(api);
    const jwk = keys.find(function (k) { return k.kid === header.kid; });
    if (!jwk) return null;

    const pub = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const signed = Buffer.from(parts[0] + '.' + parts[1]);
    const ok = crypto.verify('RSA-SHA256', signed, pub, b64urlToBuf(parts[2]));
    if (!ok) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && now > payload.exp + 5) return null;   // expiré (tolérance 5 s)
    if (typeof payload.nbf === 'number' && now < payload.nbf - 5) return null;   // pas encore valide
    if (payload.iss && String(payload.iss).indexOf(api) < 0) return null;        // émetteur = instance Clerk
    return payload;
  } catch (e) { return null; }
}

// Auth admin. true si : (1) Bearer == PUBLISH_SECRET (repli), OU (2) jeton de session Clerk valide.
async function requireAuth(req) {
  if (requireBearer(req)) return true; // rapide, sans réseau
  const bearer = (((req && req.headers) || {})['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (bearer && (process.env.CLERK_PUBLISHABLE_KEY || '').trim()) {
    const payload = await verifyClerkJwt(bearer);
    if (payload) return true;
  }
  return false;
}

function _resetCache() { _jwks = null; _jwksAt = 0; }

module.exports = { requireAuth, verifyClerkJwt, clerkFrontendApi, _resetCache };

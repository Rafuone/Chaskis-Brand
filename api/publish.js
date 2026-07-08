// api/publish.js — Vercel Serverless Function, route POST /api/publish.
//
// Reçoit le contenu édité depuis l'admin, l'authentifie et le valide, puis écrit
// site-content.json dans le dépôt Git via l'API GitHub Contents (le push redéploie
// le site). Aucun secret côté client : le jeton GitHub vit uniquement dans les
// variables d'environnement Vercel.
//
// Convention projet : CommonJS, réponse Node brute, aucune dépendance npm (fetch et
// crypto natifs de Node 18+). Voir docs/schema/site-content.md.
//
// Variables d'environnement requises (Vercel > Settings > Environment Variables) :
//   PUBLISH_SECRET  : jeton partagé, comparé en temps constant à l'en-tête Bearer.
//   GITHUB_TOKEN    : PAT fine-grained, Contents:write sur CE dépôt uniquement.
//   GITHUB_REPO     : "owner/repo".
//   GITHUB_BRANCH   : branche cible (ex. "main"). Défaut "main".
'use strict';

const crypto = require('crypto');
const { validateContent, SCHEMA_VERSION } = require('./_lib/content-schema');

const CONTENT_PATH = 'site-content.json';
const MAX_BODY_BYTES = 300 * 1024;

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

// Comparaison en temps constant (évite les attaques par timing sur le secret).
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

// Lit le corps JSON : req.body si déjà parsé (Vercel), sinon bufferise le flux (Node brut).
function readJson(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    let tooBig = false;
    req.on('data', (c) => {
      raw += c;
      if (raw.length > MAX_BODY_BYTES) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return resolve({ __error: 'trop volumineux' });
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({ __error: 'JSON illisible' }); }
    });
    req.on('error', () => resolve({ __error: 'lecture interrompue' }));
  });
}

// Appel GitHub avec timeout dur (le plan Hobby coupe les Functions vers ~10 s).
async function gh(url, opts, token) {
  opts = opts || {};
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const headers = Object.assign({
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'chaskis-publish',
  }, opts.headers || {});
  try {
    return await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'méthode non autorisée' });

  // 1. Auth : en-tête Authorization: Bearer <PUBLISH_SECRET>, comparé en temps constant.
  const secret = process.env.PUBLISH_SECRET;
  const auth = req.headers['authorization'] || '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(bearer, secret)) return send(res, 401, { error: 'non autorisé' });

  // 2. Corps.
  const body = await readJson(req);
  if (!body || body.__error) return send(res, 400, { error: body && body.__error ? body.__error : 'corps manquant' });

  // 3. Validation stricte via le contrat partagé.
  const { ok, errors } = validateContent(body);
  if (!ok) return send(res, 400, { error: 'schéma invalide', details: errors });

  // 4. Config serveur.
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repo) return send(res, 500, { error: 'configuration serveur incomplète (GITHUB_TOKEN / GITHUB_REPO)' });

  const apiUrl = 'https://api.github.com/repos/' + repo + '/contents/' + CONTENT_PATH;
  const contentB64 = Buffer.from(JSON.stringify(body, null, 2), 'utf8').toString('base64');
  const version = typeof body.version === 'string' ? body.version : ('v' + SCHEMA_VERSION);
  const author = typeof body.updatedBy === 'string' && body.updatedBy ? body.updatedBy : 'admin';

  try {
    // 5. GET du SHA courant (404 = premier commit, pas de SHA).
    let sha;
    const getRes = await gh(apiUrl + '?ref=' + encodeURIComponent(branch), { method: 'GET' }, token);
    if (getRes.status === 200) {
      const j = await getRes.json();
      sha = j && j.sha;
    } else if (getRes.status !== 404) {
      return send(res, 502, { error: 'lecture GitHub échouée (' + getRes.status + ')' });
    }

    // 6. PUT (create ou update).
    const putBody = {
      message: 'publish ' + version + ' par ' + author,
      content: contentB64,
      branch: branch,
    };
    if (sha) putBody.sha = sha;

    const putRes = await gh(apiUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(putBody),
    }, token);

    // 409/422 = SHA obsolète => édition concurrente : on demande de recharger.
    if (putRes.status === 409 || putRes.status === 422) {
      return send(res, 409, { error: 'quelqu\'un vient de publier, rechargez puis republiez' });
    }
    if (putRes.status !== 200 && putRes.status !== 201) {
      return send(res, 502, { error: 'écriture GitHub échouée (' + putRes.status + ')' });
    }
    const out = await putRes.json();
    const commit = out && out.commit && out.commit.sha;
    return send(res, 200, { ok: true, version: version, commit: commit });
  } catch (e) {
    const aborted = e && (e.name === 'AbortError');
    return send(res, aborted ? 504 : 502, { error: aborted ? 'délai GitHub dépassé' : 'erreur réseau GitHub' });
  }
};

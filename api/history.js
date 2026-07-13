// api/history.js — Vercel Serverless Function, route GET /api/history.
//
// Liste les versions PUBLIÉES du contenu : chaque publication = un commit de
// site-content.json (chantier "publish"), donc l'historique des versions EST
// l'historique Git de ce fichier. On le lit via l'API GitHub Commits.
//
// Lecture seule. Auth par Bearer PUBLISH_SECRET (comme /api/publish) : on n'expose
// pas l'historique sans la clé. Le jeton GitHub reste côté serveur uniquement.
//
// Convention projet : CommonJS, réponse Node brute, aucune dépendance (fetch + crypto natifs).
'use strict';

const crypto = require('crypto');

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

async function gh(url, token) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'chaskis-history',
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });

  const secret = (process.env.PUBLISH_SECRET || '').trim();
  const bearer = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(bearer, secret)) return send(res, 401, { error: 'non autorisé' });

  const token = (process.env.GITHUB_TOKEN || '').trim();
  const repo = (process.env.GITHUB_REPO || '').trim();
  const branch = (process.env.GITHUB_BRANCH || 'main').trim();
  if (!token || !repo) return send(res, 500, { error: 'configuration serveur incomplète (GITHUB_TOKEN / GITHUB_REPO)' });

  try {
    const url = 'https://api.github.com/repos/' + repo + '/commits?sha=' + encodeURIComponent(branch) + '&path=site-content.json&per_page=30';
    const r = await gh(url, token);
    if (r.status !== 200) return send(res, 502, { error: 'lecture de l\'historique échouée (' + r.status + ')' });
    const arr = await r.json();
    const versions = (Array.isArray(arr) ? arr : []).map(function (c) {
      const cm = (c && c.commit) || {};
      const au = cm.author || {};
      return {
        sha: c && c.sha,
        shortSha: (c && c.sha ? c.sha.slice(0, 7) : ''),
        date: au.date || null,
        author: au.name || '—',
        message: (cm.message || '').split('\n')[0],
      };
    });
    return send(res, 200, { ok: true, versions: versions });
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    return send(res, aborted ? 504 : 502, { error: aborted ? 'délai GitHub dépassé' : 'erreur réseau GitHub' });
  }
};

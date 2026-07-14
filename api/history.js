// api/history.js — Vercel Serverless Function, route GET /api/history.
//
// Liste les versions PUBLIÉES du contenu : chaque publication = un commit de
// site-content.json (chantier "publish"), donc l'historique des versions EST
// l'historique Git de ce fichier. On le lit via l'API GitHub Commits.
//
// Lecture seule. Auth par Bearer PUBLISH_SECRET (comme /api/publish) : on n'expose
// pas l'historique sans la clé. Le jeton GitHub reste côté serveur uniquement.
//
// Convention projet : CommonJS, réponse Node brute, aucune dépendance. Helpers dans api/_lib/.
'use strict';

const { send } = require('./_lib/http');
const { requireAuth } = require('./_lib/session');
const { can } = require('./_lib/rbac');
const { ghConfig, gh } = require('./_lib/github');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });

  const auth = await requireAuth(req);
  if (!auth) return send(res, 401, { error: 'non autorisé' });
  // Capacité requise : consulter l'historique des versions (versions.view).
  if (!can('versions.view', auth)) return send(res, 403, { error: 'accès refusé', need: 'versions.view' });

  const { token, repo, branch } = ghConfig();
  if (!token || !repo) return send(res, 500, { error: 'configuration serveur incomplète (GITHUB_TOKEN / GITHUB_REPO)' });

  try {
    const url = 'https://api.github.com/repos/' + repo + '/commits?sha=' + encodeURIComponent(branch) + '&path=site-content.json&per_page=30';
    const r = await gh(url, { method: 'GET' }, token);
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

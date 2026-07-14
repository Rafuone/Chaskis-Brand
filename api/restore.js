// api/restore.js — Vercel Serverless Function, route POST /api/restore.
//
// Restaure une version PUBLIÉE : reprend le contenu de site-content.json tel qu'il était
// à un commit donné, le revalide, et le réécrit comme un NOUVEAU commit (revert propre —
// jamais de réécriture d'historique). Ainsi « revenir en arrière » reste tracé et réversible.
//
// Auth Bearer PUBLISH_SECRET. Body : { sha:"<commit>" }. Convention : CommonJS, réponse
// Node brute, aucune dépendance. Helpers partagés dans api/_lib/. Voir publish.js, history.js.
'use strict';

const { validateContent } = require('./_lib/content-schema');
const { send, readJson } = require('./_lib/http');
const { requireAuth } = require('./_lib/session');
const { ghConfig, contentsUrl, gh } = require('./_lib/github');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'méthode non autorisée' });

  if (!(await requireAuth(req))) return send(res, 401, { error: 'non autorisé' });

  const body = await readJson(req, 4096);
  const sha = body && body.sha;
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) return send(res, 400, { error: 'identifiant de version (sha) manquant ou invalide' });

  const { token, repo, branch } = ghConfig();
  if (!token || !repo) return send(res, 500, { error: 'configuration serveur incomplète (GITHUB_TOKEN / GITHUB_REPO)' });

  const apiUrl = contentsUrl(repo);

  try {
    // 1. Contenu de site-content.json AU commit choisi.
    const atRes = await gh(apiUrl + '?ref=' + encodeURIComponent(sha), { method: 'GET' }, token);
    if (atRes.status === 404) return send(res, 404, { error: 'version introuvable' });
    if (atRes.status !== 200) return send(res, 502, { error: 'lecture de la version échouée (' + atRes.status + ')' });
    const atJson = await atRes.json();
    const decoded = Buffer.from(atJson.content || '', 'base64').toString('utf8');

    // 2. Revalider : on ne restaure jamais un contenu invalide.
    let parsed;
    try { parsed = JSON.parse(decoded); } catch (e) { return send(res, 400, { error: 'le contenu de cette version est illisible' }); }
    const { ok, errors } = validateContent(parsed);
    if (!ok) return send(res, 400, { error: 'contenu de la version invalide', details: errors });

    // 3. SHA courant du fichier (pour l'update).
    let curSha;
    const headRes = await gh(apiUrl + '?ref=' + encodeURIComponent(branch), { method: 'GET' }, token);
    if (headRes.status === 200) { const hj = await headRes.json(); curSha = hj && hj.sha; }
    else if (headRes.status !== 404) return send(res, 502, { error: 'lecture courante échouée (' + headRes.status + ')' });

    // 4. Réécriture = nouveau commit (revert propre).
    const putBody = { message: 'restore ' + sha.slice(0, 7), content: Buffer.from(decoded, 'utf8').toString('base64'), branch: branch };
    if (curSha) putBody.sha = curSha;
    const putRes = await gh(apiUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(putBody) }, token);
    if (putRes.status === 409 || putRes.status === 422) return send(res, 409, { error: 'quelqu\'un vient de publier, rechargez puis réessayez' });
    if (putRes.status !== 200 && putRes.status !== 201) return send(res, 502, { error: 'écriture GitHub échouée (' + putRes.status + ')' });
    const out = await putRes.json();
    return send(res, 200, { ok: true, restored: sha.slice(0, 7), commit: out && out.commit && out.commit.sha });
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    return send(res, aborted ? 504 : 502, { error: aborted ? 'délai GitHub dépassé' : 'erreur réseau GitHub' });
  }
};

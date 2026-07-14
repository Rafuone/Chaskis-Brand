// api/publish.js — Vercel Serverless Function, route POST /api/publish.
//
// Reçoit le contenu édité depuis l'admin, l'authentifie et le valide, puis écrit
// site-content.json dans le dépôt Git via l'API GitHub Contents (le push redéploie
// le site). Aucun secret côté client : le jeton GitHub vit uniquement dans les
// variables d'environnement.
//
// Convention projet : CommonJS, réponse Node brute, aucune dépendance npm (fetch et
// crypto natifs de Node 18+). Helpers partagés dans api/_lib/. Voir docs/schema/site-content.md.
//
// Variables d'environnement requises :
//   PUBLISH_SECRET  : jeton partagé, comparé en temps constant à l'en-tête Bearer.
//   GITHUB_TOKEN    : PAT fine-grained, Contents:write sur CE dépôt uniquement.
//   GITHUB_REPO     : "owner/repo".
//   GITHUB_BRANCH   : branche cible (ex. "main"). Défaut "main".
'use strict';

const { validateContent, SCHEMA_VERSION } = require('./_lib/content-schema');
const { send, readJson } = require('./_lib/http');
const { requireAuth } = require('./_lib/session');
const { ghConfig, contentsUrl, gh } = require('./_lib/github');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'méthode non autorisée' });

  // 1. Auth : session Clerk (JWT) OU clé partagée PUBLISH_SECRET (repli).
  if (!(await requireAuth(req))) return send(res, 401, { error: 'non autorisé' });

  // 2. Corps.
  const body = await readJson(req);
  if (!body || body.__error) return send(res, 400, { error: body && body.__error ? body.__error : 'corps manquant' });

  // 3. Validation stricte via le contrat partagé.
  const { ok, errors } = validateContent(body);
  if (!ok) return send(res, 400, { error: 'schéma invalide', details: errors });

  // 4. Config serveur.
  const { token, repo, branch } = ghConfig();
  if (!token || !repo) return send(res, 500, { error: 'configuration serveur incomplète (GITHUB_TOKEN / GITHUB_REPO)' });

  const apiUrl = contentsUrl(repo);
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

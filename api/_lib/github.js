// api/_lib/github.js — accès partagé à l'API GitHub Contents/Commits (publish/restore/history).
// CommonJS, aucune dépendance (fetch natif Node 18+).
'use strict';

const CONTENT_PATH = 'site-content.json';

// Config serveur, systématiquement .trim() : un espace/saut de ligne collé dans une variable
// d'env casse silencieusement l'auth (401) ou l'URL du dépôt (404).
function ghConfig() {
  return {
    token: (process.env.GITHUB_TOKEN || '').trim(),
    repo: (process.env.GITHUB_REPO || '').trim(),
    branch: (process.env.GITHUB_BRANCH || 'main').trim(),
  };
}

function contentsUrl(repo) {
  return 'https://api.github.com/repos/' + repo + '/contents/' + CONTENT_PATH;
}

// Appel GitHub avec timeout dur (les plans serverless à faible délai coupent vers ~10 s).
// Bearer fonctionne pour les deux types de PAT (classic ghp_ ET fine-grained github_pat_) ;
// « token » ne marche de façon fiable qu'avec les classiques — on prend Bearer partout.
async function gh(url, opts, token, timeoutMs) {
  opts = opts || {};
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  const headers = Object.assign({
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'chaskis',
  }, opts.headers || {});
  try {
    return await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

module.exports = { CONTENT_PATH, ghConfig, contentsUrl, gh };

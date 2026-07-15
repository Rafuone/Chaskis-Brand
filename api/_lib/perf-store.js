// api/_lib/perf-store.js — historique des mesures de performance, CÔTÉ SERVEUR (durable, partagé).
//
// Jusqu'ici l'historique perf vivait dans le localStorage de l'admin (par navigateur, perdu au
// vidage, non partagé). Ici il est persisté côté serveur : partagé entre appareils/admins, durable.
//
// COUTURE de stockage (comme les autres chantiers) — fournisseur par ENV `PERF_STORE` :
//   - "github" (défaut si GITHUB_TOKEN+REPO présents) : écrit `data/perf-history.json` dans le
//     dépôt via l'API Contents (réutilise api/_lib/github.js — même mécanisme que publish). Durable
//     et sans compte supplémentaire. Cible finale Azure : Azure Blob / Table (même interface).
//   - "memory" : tableau en mémoire (tests + repli éphémère si aucun stockage configuré).
//   - "off" : désactivé.
// Tout est FAIL-SOFT : une lecture qui échoue renvoie [] (l'admin retombe sur son historique local),
// une écriture qui échoue renvoie { ok:false } sans jamais faire planter le cron.
'use strict';

var { ghConfig, contentsUrlFor, gh } = require('./github');

var HIST_PATH = 'data/perf-history.json';
var MAX_ENTRIES = 90; // ~3 mois à une mesure/jour ; fenêtre glissante (le fichier reste petit)

var _mem = []; // fournisseur mémoire

function provider() {
  var p = (process.env.PERF_STORE || '').trim().toLowerCase();
  if (p === 'memory' || p === 'github' || p === 'off') return p;
  var g = ghConfig();
  return (g.token && g.repo) ? 'github' : 'memory';
}

async function ghRead() {
  var g = ghConfig();
  if (!g.token || !g.repo) return { entries: [], sha: null };
  var url = contentsUrlFor(g.repo, HIST_PATH) + '?ref=' + encodeURIComponent(g.branch);
  var r = await gh(url, { method: 'GET' }, g.token);
  if (r.status === 404) return { entries: [], sha: null }; // fichier pas encore créé
  if (!r.ok) throw new Error('lecture GitHub ' + r.status);
  var j = await r.json();
  var content = (j && j.content) ? Buffer.from(j.content, 'base64').toString('utf8') : '';
  var parsed = null;
  // Contenu NON vide illisible = fichier corrompu : on JETTE plutôt que renvoyer []+sha (qui ferait
  // ÉCRASER l'historique par la mesure suivante = perte de données). L'appelant fail-soft : lecture
  // -> [] (repli local), écriture -> { ok:false } sans clobberer. Un vrai fichier vide reste ok.
  if (content && content.trim()) { try { parsed = JSON.parse(content); } catch (e) { throw new Error('historique perf corrompu (JSON illisible)'); } }
  return { entries: (parsed && Array.isArray(parsed.entries)) ? parsed.entries : [], sha: (j && j.sha) || null };
}

async function ghWrite(entries, sha) {
  var g = ghConfig();
  var putBody = {
    message: 'chore(perf): historique automatique des mesures (' + entries.length + ' entrées)',
    content: Buffer.from(JSON.stringify({ entries: entries }, null, 2), 'utf8').toString('base64'),
    branch: g.branch,
  };
  if (sha) putBody.sha = sha;
  var r = await gh(contentsUrlFor(g.repo, HIST_PATH), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(putBody) }, g.token);
  if (!r.ok) throw new Error('écriture GitHub ' + r.status);
  return true;
}

// Historique complet (le plus ancien en tête). [] en cas d'échec (fail-soft).
async function readHistory() {
  try {
    if (provider() === 'github') { var g = await ghRead(); return g.entries; }
    if (provider() === 'off') return [];
    return _mem.slice();
  } catch (e) { return []; }
}

// Ajoute des mesures et rogne à MAX_ENTRIES (fenêtre glissante). { ok, appended, total }.
async function appendMeasurements(entries) {
  entries = (entries || []).filter(Boolean);
  if (!entries.length) return { ok: true, appended: 0 };
  try {
    if (provider() === 'off') return { ok: false, error: 'stockage désactivé (PERF_STORE=off)' };
    if (provider() === 'github') {
      // Retry UNIQUE sur conflit de sha (409/422) : deux écritures concurrentes (cron + déclenchement
      // manuel) — on relit le sha à jour et on ré-append (les entrées de l'autre écrivain sont
      // relues, donc préservées, sans doublon des nôtres). Anti-perte de données.
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          var g = await ghRead();
          var all = g.entries.concat(entries);
          if (all.length > MAX_ENTRIES) all = all.slice(all.length - MAX_ENTRIES);
          await ghWrite(all, g.sha);
          return { ok: true, appended: entries.length, total: all.length };
        } catch (e) {
          if (attempt === 0 && /\b(409|422)\b/.test(String((e && e.message) || ''))) continue; // conflit -> relire + réessayer
          throw e;
        }
      }
    }
    _mem = _mem.concat(entries);
    if (_mem.length > MAX_ENTRIES) _mem = _mem.slice(_mem.length - MAX_ENTRIES);
    return { ok: true, appended: entries.length, total: _mem.length };
  } catch (e) { return { ok: false, error: (e && e.message) || 'échec écriture' }; }
}

function _resetMemory() { _mem = []; }

module.exports = { readHistory: readHistory, appendMeasurements: appendMeasurements, provider: provider, HIST_PATH: HIST_PATH, MAX_ENTRIES: MAX_ENTRIES, _resetMemory: _resetMemory };

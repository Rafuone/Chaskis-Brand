// api/perf-history.js — lecture de l'historique SERVEUR des mesures de performance (planifiées).
// GET, capacité perf.view. Renvoie les entrées (le plus ancien en tête). Repli fail-soft : si le
// stockage est indisponible, renvoie une liste vide (l'admin retombe sur son historique local).
'use strict';

var { send } = require('./_lib/http');
var { requireAuth } = require('./_lib/session');
var { can } = require('./_lib/rbac');
var store = require('./_lib/perf-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'méthode non autorisée' });

  var auth = await requireAuth(req);
  if (!auth) return send(res, 401, { error: 'non autorisé' });
  if (!can('perf.view', auth)) return send(res, 403, { error: 'accès refusé', need: 'perf.view' });

  var entries = await store.readHistory();
  return send(res, 200, { ok: true, entries: entries, provider: store.provider() });
};

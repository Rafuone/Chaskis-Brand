// api/_lib/http.js — helpers HTTP partagés par les Functions /api.
// CommonJS, aucune dépendance. Réponse Node brute (portable Vercel / Azure / Express).
'use strict';

// Réponse JSON standard : statut + no-store + corps sérialisé.
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

// Lit le corps JSON. req.body si déjà parsé (Vercel) ; sinon bufferise le flux (Node brut).
// Bufferise en Buffer (jamais `raw += chunk` : corromprait un caractère multi-octets coupé
// entre deux chunks — accents FR). `done` + écoute de 'close' garantissent que la Promise se
// résout TOUJOURS, même sur corps trop gros (req.destroy n'émet ni 'end' ni 'error').
// Renvoie l'objet parsé, `null` si corps vide, ou `{ __error }` en cas de problème.
function readJson(req, maxBytes, oversizeMsg) {
  const cap = maxBytes || 300 * 1024;
  const big = oversizeMsg || 'trop volumineux';
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    const chunks = []; let size = 0, done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    req.on('data', (c) => { chunks.push(c); size += c.length; if (size > cap) { finish({ __error: big }); try { req.destroy(); } catch (e) {} } });
    req.on('end', () => { if (!chunks.length) return finish(null); try { finish(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { finish({ __error: 'JSON illisible' }); } });
    req.on('error', () => finish({ __error: 'lecture interrompue' }));
    req.on('close', () => finish({ __error: 'connexion fermée' }));
  });
}

module.exports = { send, readJson };

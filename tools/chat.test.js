// tools/chat.test.js — harnais de test du chantier CHATBOT, SANS dépendance.
//
// Couvre : la récupération RAG (api/_lib/rag), le routage de la couture LLM
// (api/_lib/llm), et l'endpoint POST /api/chat (api/chat) en mode extractif,
// génératif (fetch mocké), repli et validation d'entrée.
//
// Lancer :   node tools/chat.test.js
// Aucun réseau, aucune clé requise (le mode génératif est simulé).
'use strict';

var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var rag = require(path.join(ROOT, 'api/_lib/rag'));
var llm = require(path.join(ROOT, 'api/_lib/llm'));

var pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }
function section(t) { console.log('\n' + t); }

// --- Faux req/res pour appeler le handler sans serveur HTTP ------------------
function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (s) { this.body = s; },
    json: function () { try { return JSON.parse(this.body); } catch (e) { return null; } },
  };
}
// req avec body déjà parsé (le handler accepte req.body objet, comme sur Vercel).
function fakeReq(method, body) { return { method: method, headers: {}, body: body, on: function () {} }; }

async function callChat(body, method) {
  // recharge le handler à neuf pour prendre en compte l'état d'env courant
  delete require.cache[require.resolve(path.join(ROOT, 'api/chat.js'))];
  var handler = require(path.join(ROOT, 'api/chat.js'));
  var res = fakeRes();
  await handler(fakeReq(method || 'POST', body), res);
  return res;
}

(async function main() {
  // =========================================================================
  section('RAG — récupération');
  var KB = require(path.join(ROOT, 'api/_data/kb.json'));
  var index = rag.buildIndex(KB.passages);

  var rTarif = rag.retrieve(index, 'Quels sont vos tarifs de livraison ?', { lang: 'fr', topK: 3 });
  ok(rTarif.length > 0 && /tarif/i.test(rTarif[0].passage.title), 'question tarifs -> passage tarifs en tête (' + (rTarif[0] && rTarif[0].passage.id) + ')');

  var rZone = rag.retrieve(index, 'Livrez-vous à Lausanne et Nyon ?', { lang: 'fr', topK: 3 });
  ok(rZone.length > 0 && /zone/i.test(rZone[0].passage.title), 'question zones -> passage zones en tête (' + (rZone[0] && rZone[0].passage.id) + ')');

  var rPermis = rag.retrieve(index, 'Quel permis faut-il pour postuler comme coursier ?', { lang: 'fr', topK: 3 });
  ok(rPermis.length > 0 && rPermis[0].passage.id === 'postuler-permis-fr', 'question permis -> passage permis en tête');

  var rEn = rag.retrieve(index, 'What are your delivery rates?', { lang: 'en', topK: 3 });
  ok(rEn.length > 0 && rEn[0].passage.lang === 'en', 'question EN -> passage EN (filtre langue)');
  ok(rEn.every(function (r) { return r.passage.lang === 'en'; }), 'filtre langue : aucun passage FR dans un résultat EN');

  var rEmpty = rag.retrieve(index, '???', { lang: 'fr' });
  ok(rEmpty.length === 0, 'requête sans jeton utile -> aucun résultat');

  var rNo = rag.retrieve(index, 'zzzz xyzzy quux', { lang: 'fr' });
  ok(rNo.length === 0, 'requête hors sujet -> aucun résultat (pas de faux positif)');

  var snip = rag.snippet(KB.passages.find(function (p) { return p.id === 'livraison-delais-fr'; }).text, 'super express 2 heures', 300);
  ok(/express/i.test(snip) && snip.length <= 300, 'snippet : extrait pertinent et borné (' + snip.length + ' car.)');

  ok(rag.tokenize('Livrez-vous à Genève ?').indexOf('geneve') >= 0, 'tokenize : accents repliés (Genève -> geneve)');
  ok(rag.tokenize('Facture avec TVA ?').indexOf('tva') >= 0, 'tokenize : sigle court conservé (tva)');

  // =========================================================================
  section('LLM — routage des fournisseurs (sans réseau)');
  ok(llm.endpoint({ provider: 'groq', key: 'k' }).url.indexOf('groq.com') >= 0, 'groq -> URL groq.com');
  ok(llm.endpoint({ provider: 'openai', key: 'k' }).url === 'https://api.openai.com/v1/chat/completions', 'openai -> URL officielle');
  var az = llm.endpoint({ provider: 'azure-openai', key: 'k', model: 'gpt4o', baseUrl: 'https://r.openai.azure.com/', apiVersion: '2024-02-15-preview' });
  ok(az.url.indexOf('/openai/deployments/gpt4o/chat/completions') >= 0 && az.headers['api-key'] === 'k' && az.modelInBody === false, 'azure-openai -> URL déploiement + en-tête api-key + modèle hors corps');

  var savedKey = process.env.LLM_API_KEY, savedProv = process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY; delete process.env.LLM_PROVIDER;
  ok(llm.isConfigured() === false, 'isConfigured=false sans clé');
  process.env.LLM_API_KEY = 'test'; process.env.LLM_PROVIDER = 'groq';
  ok(llm.isConfigured() === true, 'isConfigured=true avec clé');
  delete process.env.LLM_API_KEY; delete process.env.LLM_PROVIDER;

  // =========================================================================
  section('Endpoint /api/chat — sans clé (mode extractif)');
  delete process.env.LLM_API_KEY; delete process.env.LLM_PROVIDER;

  var r405 = await callChat({ question: 'x' }, 'GET');
  ok(r405.statusCode === 405, 'GET -> 405');

  var r400 = await callChat({ question: '   ' }, 'POST');
  ok(r400.statusCode === 400, 'question vide -> 400');

  var rExtr = await callChat({ question: 'Quels sont vos tarifs ?', lang: 'fr' });
  var jExtr = rExtr.json();
  ok(rExtr.statusCode === 200 && jExtr.mode === 'extractive', 'tarifs sans clé -> 200 extractif');
  ok(jExtr.answer && jExtr.answer.length > 0 && jExtr.sources.length > 0, 'extractif : réponse + sources non vides');

  var rFall = await callChat({ question: 'zzzz xyzzy quux', lang: 'fr' });
  var jFall = rFall.json();
  ok(rFall.statusCode === 200 && jFall.mode === 'fallback' && /chaskis\.ch/.test(jFall.answer), 'hors sujet -> repli honnête (coordonnées)');

  var rEnEp = await callChat({ question: 'How do I apply for a job?', lang: 'en' });
  var jEnEp = rEnEp.json();
  ok(rEnEp.statusCode === 200 && jEnEp.lang === 'en' && /permit|apply|CCT|welcome/i.test(jEnEp.answer), 'question EN -> réponse EN');

  // =========================================================================
  section('Endpoint /api/chat — avec clé (mode génératif, fetch mocké)');
  var realFetch = global.fetch;
  var captured = null;
  global.fetch = async function (url, init) {
    captured = { url: url, init: init };
    return { ok: true, json: async function () { return { choices: [{ message: { content: 'Réponse générée ancrée sur le contexte.' } }] }; } };
  };
  process.env.LLM_API_KEY = 'test-key'; process.env.LLM_PROVIDER = 'groq'; process.env.LLM_MODEL = 'llama-3.1-8b-instant';

  var rGen = await callChat({ question: 'Quels sont vos délais de livraison ?', lang: 'fr' });
  var jGen = rGen.json();
  ok(rGen.statusCode === 200 && jGen.mode === 'generative', 'avec clé -> 200 génératif');
  ok(jGen.answer === 'Réponse générée ancrée sur le contexte.', 'génératif : renvoie le texte du modèle');
  ok(captured && /groq\.com/.test(captured.url), 'génératif : appel dirigé vers groq');
  var sentBody = captured && JSON.parse(captured.init.body);
  ok(sentBody && /Contexte/.test(sentBody.messages[0].content), 'génératif : contexte RAG injecté dans le prompt système');

  // Échec LLM -> repli extractif transparent (jamais d'erreur pour l'utilisateur)
  global.fetch = async function () { return { ok: false, status: 500 }; };
  var rGenFail = await callChat({ question: 'Quels sont vos tarifs ?', lang: 'fr' });
  var jGenFail = rGenFail.json();
  ok(rGenFail.statusCode === 200 && jGenFail.mode === 'extractive', 'LLM en échec -> repli extractif (200, pas d\'erreur)');

  global.fetch = realFetch;
  delete process.env.LLM_API_KEY; delete process.env.LLM_PROVIDER; delete process.env.LLM_MODEL;
  if (savedKey !== undefined) process.env.LLM_API_KEY = savedKey;
  if (savedProv !== undefined) process.env.LLM_PROVIDER = savedProv;

  // =========================================================================
  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR HARNAIS', e); process.exit(2); });

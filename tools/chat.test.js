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
var schema = require(path.join(ROOT, 'api/_lib/content-schema'));

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
  section('Chatbot Phase 2 — réglages admin publiés (schéma + endpoint)');
  var b = { schemaVersion: 1 };
  ok(schema.validateContent(Object.assign({}, b, { chatbot: { forbidden: ['marges', 'salaires'], tone: 'pro', fallback: 'Contactez-nous', instructions: 'Reste factuel', botName: 'Assistant' } })).ok, 'schéma : section chatbot valide acceptée');
  ok(!schema.validateContent(Object.assign({}, b, { chatbot: { forbidden: 'pas-un-tableau' } })).ok, 'schéma : forbidden non-tableau rejeté');
  ok(!schema.validateContent(Object.assign({}, b, { chatbot: { cleFolle: 'x' } })).ok, 'schéma : clé chatbot inconnue rejetée');
  ok(!schema.validateContent(Object.assign({}, b, { chatbot: { fallback: '<script>alert(1)</script>' } })).ok, 'schéma : XSS dans un champ chatbot rejeté');
  ok(!schema.validateContent(Object.assign({}, b, { chatbot: { forbidden: [42] } })).ok, 'schéma : forbidden avec non-chaîne rejeté');

  var chatMod = require(path.join(ROOT, 'api/chat.js'));
  ok(chatMod.isForbidden('Quelles sont vos marges internes ?', ['marges internes']) === true, 'isForbidden : sujet interdit détecté');
  ok(chatMod.isForbidden('Quels sont vos tarifs ?', ['marges internes']) === false, 'isForbidden : sujet autorisé non bloqué');
  ok(chatMod.isForbidden('bonjour', []) === false, 'isForbidden : liste vide -> jamais bloqué');
  ok(chatMod.isForbidden('Comment mes clients passent-ils commande ?', ['Données clients']) === false, 'isForbidden : question légitime avec « clients » NON bloquée (il faut TOUS les mots du sujet)');
  ok(chatMod.isForbidden('Quelles sont vos données clients ?', ['Données clients']) === true, 'isForbidden : « données clients » (tous les mots) bien bloqué');

  delete process.env.LLM_API_KEY; delete process.env.LLM_PROVIDER; // repli/interdit ne passent pas par le LLM
  chatMod._setTestConfig({ forbidden: ['marges'], fallback: 'Repli personnalisé de test.' });
  var rForb = fakeRes(); await chatMod(fakeReq('POST', { question: 'Quelles sont vos marges ?', lang: 'fr' }), rForb);
  ok(rForb.statusCode === 200 && rForb.json().mode === 'forbidden' && rForb.json().answer === 'Repli personnalisé de test.', 'endpoint : sujet interdit -> mode forbidden + repli personnalisé');
  var rFb = fakeRes(); await chatMod(fakeReq('POST', { question: 'zzzz xyzzy quux', lang: 'fr' }), rFb);
  ok(rFb.json().mode === 'fallback' && rFb.json().answer === 'Repli personnalisé de test.', 'endpoint : repli personnalisé utilisé pour une question hors-sujet');
  var rOk = fakeRes(); await chatMod(fakeReq('POST', { question: 'Quels sont vos tarifs ?', lang: 'fr' }), rOk);
  ok(rOk.json().mode === 'extractive' && rOk.json().answer.length > 0, 'endpoint : question autorisée répond normalement malgré la config');

  // Sources publiées -> indexées dans la base du bot (l'admin "entraîne" le bot, gratuit)
  chatMod._setTestConfig({ sources: [{ title: 'Politique retours', tags: ['Retours'], text: "Les retours de colis sont acceptés sous 14 jours ouvrables, sans frais, via un point relais partenaire." }] });
  chatMod._resetIndex();
  var rSrc = fakeRes(); await chatMod(fakeReq('POST', { question: 'Comment fonctionnent les retours de colis ?', lang: 'fr' }), rSrc);
  var jSrc = rSrc.json();
  ok(rSrc.statusCode === 200 && /14 jours|retours/i.test(jSrc.answer), 'endpoint : répond à partir d\'une SOURCE publiée par l\'admin');
  ok(jSrc.sources.some(function (s) { return /retours/i.test(s.title); }), 'endpoint : la source publiée apparaît dans les sources citées');
  chatMod._setTestConfig(null); chatMod._resetIndex();

  // =========================================================================
  section('LLM — mémoire de conversation (buildMessages)');
  var bm = llm.buildMessages({ system: 'S', user: 'Q', history: [
    { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' },
    { role: 'bogus', content: 'x' }, { role: 'user', content: '   ' },
  ] });
  ok(bm[0].role === 'system' && bm[0].content === 'S', 'buildMessages : system en tête');
  ok(bm[bm.length - 1].role === 'user' && bm[bm.length - 1].content === 'Q', 'buildMessages : question courante en dernier');
  ok(bm.length === 4 && bm[1].content === 'a' && bm[2].content === 'b', 'buildMessages : historique valide inséré, rôle inconnu et contenu vide ignorés');

  // =========================================================================
  section('Endpoint /api/chat — FLUX (SSE) + mémoire');
  // fakeRes capable de capter les res.write() successifs et d'en extraire les événements SSE.
  function fakeSseRes() {
    return {
      statusCode: 0, headers: {}, chunks: [], ended: false,
      setHeader: function (k, v) { this.headers[k] = v; },
      write: function (s) { this.chunks.push(String(s)); },
      end: function (s) { if (s !== undefined) this.chunks.push(String(s)); this.ended = true; },
      events: function () {
        return this.chunks.join('').split('\n\n').filter(Boolean).map(function (block) {
          var ev = 'message', data = '';
          block.split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) ev = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
          });
          var obj = null; try { obj = JSON.parse(data); } catch (e) {}
          return { ev: ev, data: obj };
        });
      },
    };
  }
  async function callChatStream(body) {
    delete require.cache[require.resolve(path.join(ROOT, 'api/chat.js'))];
    var handler = require(path.join(ROOT, 'api/chat.js'));
    var res = fakeSseRes();
    await handler(fakeReq('POST', body), res);
    return res;
  }
  // Corps fetch simulant un flux SSE OpenAI-compatible (getReader().read()).
  function sseBody(parts) {
    var enc = new TextEncoder();
    var q = parts.map(function (p) { return enc.encode(p); }), i = 0;
    return { getReader: function () { return { read: function () { return Promise.resolve(i < q.length ? { done: false, value: q[i++] } : { done: true }); } }; } };
  }

  var savedK2 = process.env.LLM_API_KEY, savedP2 = process.env.LLM_PROVIDER, savedM2 = process.env.LLM_MODEL, realFetch2 = global.fetch;

  // (a) Sans clé : le streaming reste fonctionnel (mode extractif, un seul bloc).
  delete process.env.LLM_API_KEY; delete process.env.LLM_PROVIDER;
  var rse = await callChatStream({ question: 'Quels sont vos tarifs ?', lang: 'fr', stream: true });
  var evse = rse.events();
  ok((rse.headers['Content-Type'] || '').indexOf('text/event-stream') >= 0, 'SSE : en-tête text/event-stream');
  ok(evse[0].ev === 'meta' && evse.some(function (e) { return e.ev === 'delta' && e.data.t; }) && evse[evse.length - 1].ev === 'done' && evse[evse.length - 1].data.mode === 'extractive', 'SSE sans clé : meta -> delta -> done(extractive)');

  // (b) Avec clé : vrai flux token par token relayé.
  process.env.LLM_API_KEY = 'k'; process.env.LLM_PROVIDER = 'groq'; process.env.LLM_MODEL = 'llama-3.1-8b-instant';
  var capStream = null;
  global.fetch = async function (url, init) {
    capStream = { url: url, init: init };
    return { ok: true, status: 200, body: sseBody([
      'data: {"choices":[{"delta":{"content":"Nos "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"délais "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"sont courts."}}]}\n\n',
      'data: [DONE]\n\n',
    ]) };
  };
  var rs = await callChatStream({ question: 'Quels sont vos délais ?', lang: 'fr', stream: true });
  var evs = rs.events();
  var deltas = evs.filter(function (e) { return e.ev === 'delta'; }).map(function (e) { return e.data.t; }).join('');
  ok(evs[0].ev === 'meta', 'SSE génératif : 1er événement = meta');
  ok(deltas === 'Nos délais sont courts.', 'SSE génératif : deltas concaténés = réponse complète');
  ok(evs[evs.length - 1].ev === 'done' && evs[evs.length - 1].data.mode === 'generative', 'SSE génératif : done(generative) en fin');
  ok(capStream && JSON.parse(capStream.init.body).stream === true, 'SSE génératif : appel LLM avec stream:true');

  // (c) Mémoire : l'historique client est injecté dans les messages du LLM.
  await callChatStream({ question: 'Et pour Lausanne ?', lang: 'fr', stream: true, history: [
    { role: 'user', content: 'Vous livrez à Genève ?' }, { role: 'assistant', content: 'Oui, Genève est couverte.' },
  ] });
  var msgs = JSON.parse(capStream.init.body).messages;
  ok(msgs.some(function (m) { return m.role === 'user' && /Genève/.test(m.content); }) && msgs.some(function (m) { return m.role === 'assistant' && /couverte/.test(m.content); }), 'mémoire : l\'historique (user+assistant) est injecté dans le prompt LLM');
  ok(msgs[msgs.length - 1].role === 'user' && /Lausanne/.test(msgs[msgs.length - 1].content), 'mémoire : la question courante reste le dernier message user');

  // (d) Échec LLM total en streaming -> repli extractif en SSE (jamais d'erreur).
  global.fetch = async function () { return { ok: false, status: 500 }; };
  var rsf = await callChatStream({ question: 'Quels sont vos tarifs ?', lang: 'fr', stream: true });
  var evsf = rsf.events();
  ok(evsf[evsf.length - 1].ev === 'done' && evsf[evsf.length - 1].data.mode === 'extractive', 'SSE : échec LLM total -> repli extractif transparent');

  // (e) Non-cassant : sans stream:true, la réponse reste du JSON classique.
  delete process.env.LLM_API_KEY; delete process.env.LLM_PROVIDER;
  var rjson = await callChat({ question: 'Quels sont vos tarifs ?', lang: 'fr' });
  ok(rjson.json() && rjson.json().mode === 'extractive', 'non-cassant : sans stream -> réponse JSON inchangée');

  global.fetch = realFetch2;
  if (savedK2 !== undefined) process.env.LLM_API_KEY = savedK2; else delete process.env.LLM_API_KEY;
  if (savedP2 !== undefined) process.env.LLM_PROVIDER = savedP2; else delete process.env.LLM_PROVIDER;
  if (savedM2 !== undefined) process.env.LLM_MODEL = savedM2; else delete process.env.LLM_MODEL;

  // =========================================================================
  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' réussis, ' + fail + ' échoués');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('ERREUR HARNAIS', e); process.exit(2); });

// api/_lib/llm.js — COUTURE LLM, provider-agnostique, SANS dépendance npm.
//
// Un seul point de contact avec un modèle de langage. Groq, OpenAI et Azure OpenAI
// exposent tous le même schéma « chat completions » ; on change de fournisseur PAR
// VARIABLES D'ENVIRONNEMENT, sans toucher au code. C'est la couture prévue par la
// stratégie : compte de test aujourd'hui (Groq gratuit), Azure OpenAI en cible finale.
//
// Si aucune clé n'est configurée, isConfigured() renvoie false et l'endpoint /api/chat
// bascule automatiquement en mode extractif (réponse tirée telle quelle des passages).
// Le chatbot est donc FONCTIONNEL sans aucun compte, et devient génératif dès qu'une
// clé est posée.
//
// Variables d'environnement :
//   LLM_PROVIDER    : "groq" | "openai" | "azure-openai" | "off"
//                     (défaut : "groq" si LLM_API_KEY est présent, sinon "off")
//   LLM_API_KEY     : clé du fournisseur
//   LLM_MODEL       : modèle (ex. "llama-3.1-8b-instant", "gpt-4o-mini") ou, pour Azure,
//                     le NOM DU DÉPLOIEMENT
//   LLM_BASE_URL    : (optionnel) override du domaine ; REQUIS pour azure-openai
//                     (ex. "https://mon-ressource.openai.azure.com")
//   LLM_API_VERSION : (azure-openai) ex. "2024-02-15-preview"
//
// Voir docs/chatbot.md pour l'activation détaillée.
'use strict';

function cfg() {
  var key = (process.env.LLM_API_KEY || '').trim();
  var provider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (!provider) provider = key ? 'groq' : 'off';
  return {
    key: key,
    provider: provider,
    model: (process.env.LLM_MODEL || '').trim(),
    baseUrl: (process.env.LLM_BASE_URL || '').trim(),
    apiVersion: (process.env.LLM_API_VERSION || '').trim(),
  };
}

// Vrai seulement si une clé ET un fournisseur actif sont configurés.
function isConfigured() {
  var c = cfg();
  return !!(c.key && c.provider !== 'off');
}

// Construit l'URL + l'en-tête d'authentification selon le fournisseur.
// Exposé (testable) pour vérifier le routage sans réseau.
function endpoint(c) {
  c = c || cfg();
  if (c.provider === 'azure-openai') {
    var base = c.baseUrl.replace(/\/+$/, '');
    var ver = c.apiVersion || '2024-02-15-preview';
    return {
      url: base + '/openai/deployments/' + encodeURIComponent(c.model) + '/chat/completions?api-version=' + encodeURIComponent(ver),
      headers: { 'api-key': c.key },
      modelInBody: false,
    };
  }
  if (c.provider === 'openai') {
    var ob = (c.baseUrl || 'https://api.openai.com').replace(/\/+$/, '');
    return { url: ob + '/v1/chat/completions', headers: { 'Authorization': 'Bearer ' + c.key }, modelInBody: true };
  }
  // groq (OpenAI-compatible) + défaut.
  var gb = (c.baseUrl || 'https://api.groq.com/openai').replace(/\/+$/, '');
  return { url: gb + '/v1/chat/completions', headers: { 'Authorization': 'Bearer ' + c.key }, modelInBody: true };
}

// Appelle le modèle. Renvoie TOUJOURS un objet (ne jette pas) :
//   { configured:false }                      -> pas de clé, l'appelant bascule en extractif
//   { configured:true, ok:true, text:"..." }  -> réponse générée
//   { configured:true, ok:false, ... }        -> échec (statut/timeout/réseau) -> repli extractif
async function generate(opts) {
  opts = opts || {};
  var c = cfg();
  if (!isConfigured()) return { configured: false };
  var ep = endpoint(c);
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 8000);
  try {
    var body = {
      messages: [
        { role: 'system', content: String(opts.system || '') },
        { role: 'user', content: String(opts.user || '') },
      ],
      temperature: opts.temperature == null ? 0.2 : opts.temperature,
      max_tokens: opts.maxTokens || 400,
    };
    // Azure : le modèle est dans l'URL (déploiement), pas dans le corps.
    if (ep.modelInBody) body.model = c.model || 'llama-3.1-8b-instant';
    var r = await fetch(ep.url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ep.headers),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return { configured: true, ok: false, status: r.status };
    var j = await r.json();
    var text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    text = (text || '').trim();
    if (!text) return { configured: true, ok: false, status: 200, empty: true };
    return { configured: true, ok: true, text: text };
  } catch (e) {
    return { configured: true, ok: false, error: (e && e.name === 'AbortError') ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { isConfigured: isConfigured, generate: generate, endpoint: endpoint, _cfg: cfg };

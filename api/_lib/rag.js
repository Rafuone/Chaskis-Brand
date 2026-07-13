// api/_lib/rag.js — récupération (RAG) provider-agnostique, SANS dépendance npm.
//
// Indexe une base de connaissances (tableau de passages) et renvoie les passages les
// plus pertinents pour une question, plus un extrait ciblé. Tout est PUR et testable :
// aucune I/O, aucun réseau, aucune clé. C'est la brique commune du chatbot — la
// génération par un LLM (api/_lib/llm.js) vient PAR-DESSUS, jamais à la place.
//
// Convention projet : CommonJS, réponse Node brute côté endpoint, host-agnostique
// (tourne à l'identique sur Vercel, Azure App Service, ou un simple Node). Voir
// docs/chatbot.md.
'use strict';

// Repli d'accents pour un appariement robuste en français (é→e, ç→c, à→a…).
function fold(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Mots vides FR + EN : ils n'apportent pas de signal de pertinence.
var STOP = new Set(('au aux avec ce ces dans de des du elle en et eux il je la le les leur lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous ca cela cet cette est sont etre ete plus tres bien fait faire quel quelle quels quelles combien comment quand ou est-ce ' +
  'the of to and in is are for you your we our on at it can do does how what which when where why a an be or as with from this that these those i my me').split(/\s+/).filter(Boolean));

// Découpe une chaîne en jetons pertinents (≥2 caractères, hors mots vides).
// Longueur ≥2 pour garder « tva », « api », « cdi ».
function tokenize(s) {
  return fold(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 2 && !STOP.has(w); });
}

// Construit un index à partir des passages. Calcule l'IDF (rareté d'un terme) pour
// pondérer les termes discriminants. Appelé une fois (index mis en cache par l'endpoint).
function buildIndex(passages) {
  var list = Array.isArray(passages) ? passages : [];
  var docs = list.map(function (p) {
    var titleBag = [p.title, (p.tags || []).join(' '), (p.questions || []).join(' ')].filter(Boolean).join('  ');
    var full = titleBag + '  ' + (p.text || '');
    var tokens = tokenize(full);
    var tf = Object.create(null);
    tokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
    return { ref: p, tf: tf, titleTokens: new Set(tokenize(titleBag)) };
  });
  var N = docs.length || 1;
  var df = Object.create(null);
  docs.forEach(function (d) { Object.keys(d.tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
  function idf(t) { return Math.log(1 + N / ((df[t] || 0) + 0.5)); }
  return { docs: docs, idf: idf, N: N };
}

// Score d'un document pour une liste de jetons de requête : somme des IDF des jetons
// présents, atténuée par log(1+tf), et boostée quand le terme est dans le titre/tags/
// questions-exemples (signal fort d'intention).
function scoreDoc(doc, qTokens, idf) {
  var seen = new Set();
  var score = 0, hits = 0;
  qTokens.forEach(function (t) {
    if (seen.has(t)) return; seen.add(t);
    var f = doc.tf[t] || 0;
    if (f > 0) { hits++; score += idf(t) * (1 + Math.log(f)) * (doc.titleTokens.has(t) ? 1.9 : 1); }
  });
  return { score: score, hits: hits };
}

// Renvoie les meilleurs passages : [{passage, score, hits}], triés, filtrés par langue
// si demandée. topK par défaut = 3. Aucun résultat si la requête n'a aucun jeton utile.
function retrieve(index, query, opts) {
  opts = opts || {};
  var topK = opts.topK || 3;
  var lang = opts.lang;
  var qTokens = tokenize(query);
  if (!qTokens.length) return [];
  var out = index.docs
    .filter(function (d) { return !lang || !d.ref.lang || d.ref.lang === lang; })
    .map(function (d) { var s = scoreDoc(d, qTokens, index.idf); return { passage: d.ref, score: s.score, hits: s.hits }; })
    .filter(function (r) { return r.hits > 0; })
    .sort(function (a, b) { return b.score - a.score; });
  return out.slice(0, topK);
}

// Extrait la (ou les 2) phrase(s) du texte qui recouvrent le mieux la requête. Sert de
// réponse en mode extractif (sans LLM) — factuel, jamais inventé, borné à maxLen.
function snippet(text, query, maxLen) {
  maxLen = maxLen || 300;
  var q = new Set(tokenize(query));
  var parts = String(text || '').split(/(?<=[.!?\n])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
  if (!parts.length) return String(text || '').slice(0, maxLen);
  var scores = parts.map(function (p) {
    var toks = tokenize(p);
    var sc = toks.reduce(function (n, t) { return n + (q.has(t) ? 1 : 0); }, 0);
    return sc;
  });
  var bestIdx = 0, bestScore = -1;
  scores.forEach(function (sc, i) { if (sc > bestScore) { bestScore = sc; bestIdx = i; } });
  var chosen = parts[bestIdx];
  // Ajoute la phrase voisine la mieux notée si ça tient dans maxLen (réponse plus complète).
  var neighbor = null, nScore = -1;
  [bestIdx - 1, bestIdx + 1].forEach(function (i) {
    if (i >= 0 && i < parts.length && scores[i] > nScore) { nScore = scores[i]; neighbor = i; }
  });
  if (neighbor != null && nScore > 0 && (chosen.length + parts[neighbor].length + 1) <= maxLen) {
    chosen = neighbor < bestIdx ? (parts[neighbor] + ' ' + chosen) : (chosen + ' ' + parts[neighbor]);
  }
  if (chosen.length > maxLen) chosen = chosen.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
  return chosen;
}

module.exports = { fold: fold, tokenize: tokenize, buildIndex: buildIndex, retrieve: retrieve, snippet: snippet, scoreDoc: scoreDoc };

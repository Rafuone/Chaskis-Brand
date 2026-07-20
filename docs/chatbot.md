# Chatbot — assistant du site (RAG)

Ce document décrit le chantier **chatbot** : comment il marche, comment l'activer, et
comment il migrera vers Azure. Rien à installer, aucune dépendance npm, aucun build.

## En une phrase

L'assistant répond aux questions libres des visiteurs **à partir des faits du site**
(récupération RAG), et — si une clé LLM est configurée — reformule une réponse naturelle
en restant **strictement ancré** sur ces faits.

## Les deux modes (le chatbot marche AVEC ou SANS clé)

| | Sans clé LLM (par défaut) | Avec clé LLM |
|---|---|---|
| Récupération des passages pertinents | ✅ | ✅ |
| Réponse | **extractive** (le meilleur passage, mot pour mot) | **générative** (reformulée, concise) |
| Coût | 0 | quelques centimes / 1000 questions |
| Compte requis | aucun | oui (Groq test, ou Azure OpenAI) |

Le mode se choisit **tout seul** selon la présence de `LLM_API_KEY`. En cas d'échec du
modèle (timeout, quota, panne), l'endpoint retombe automatiquement en extractif : le
visiteur n'a jamais d'erreur.

Sur la **démo 100 % statique** (sans `/api`), le widget retombe sur ses réponses
pré-enregistrées (`assets/js/chatbot.js`) : la démo client reste riche sans backend.

## Pièces

- `api/chat.js` — endpoint `POST /api/chat` (`{ question, lang, stream?, history? }` → JSON `{ answer, mode, sources, lang }`, ou flux SSE si `stream:true`).
- `api/_lib/rag.js` — récupération pure (tokenisation FR, score TF-IDF, extrait). Testable sans clé.
- `api/_lib/llm.js` — **couture** vers le fournisseur LLM (Groq / OpenAI / Azure OpenAI), swap par variable d'env.
- `api/_data/kb.json` — la **base de connaissances** (faits FR + EN). Éditable sans toucher au code.
- `assets/js/chatbot.js` — le widget public : questions libres → `/api/chat`, repli scripté si absent.
- `tools/chat.test.js` — harnais de test (`node tools/chat.test.js`), sans réseau ni clé.

## Activer le mode génératif

### Option A — compte de test Groq (gratuit, rapide)

1. Créer une clé sur console.groq.com (gratuit).
2. Dans les variables d'environnement de l'hôte (Vercel → Settings → Environment Variables) :
   ```
   LLM_PROVIDER = groq
   LLM_API_KEY  = gsk_...            (collé ici, JAMAIS dans le code ni le dépôt)
   LLM_MODEL    = llama-3.1-8b-instant
   ```
3. Redéployer. C'est tout : `/api/chat` passe en génératif.

### Option B — Azure OpenAI (cible finale)

Aucune réécriture de code — on change seulement les variables :
```
LLM_PROVIDER    = azure-openai
LLM_API_KEY     = <clé de la ressource Azure OpenAI>
LLM_MODEL       = <nom du DÉPLOIEMENT> (ex. gpt-4o-mini)
LLM_BASE_URL    = https://<votre-ressource>.openai.azure.com
LLM_API_VERSION = 2024-02-15-preview
```
La couture `api/_lib/llm.js` construit l'URL Azure (`/openai/deployments/.../chat/completions`)
et l'en-tête `api-key` automatiquement. **C'est la seule chose à changer** pour passer du
test à la production Azure.

## Éditer les connaissances

Tout est dans `api/_data/kb.json` : un tableau de passages `{ id, lang, title, tags,
questions, text }`. Ajouter/modifier un passage suffit — pas de ré-indexation manuelle,
l'index se rebâtit au chargement.

Les **tarifs** sont un cas spécial : ils sont injectés en direct depuis `site-content.json`
(la grille réellement publiée via l'éditeur), pour que le bot reste toujours à jour quand
le client change ses prix. Voir `pricingPassages()` dans `api/chat.js`.

## Tester en local

```
node tools/chat.test.js                 # 54 tests, sans réseau
node tools/api-server.js 3199           # sert le site + /api hors Vercel
curl -X POST localhost:3199/api/chat -H 'content-type: application/json' \
     -d '{"question":"Quels sont vos tarifs ?","lang":"fr"}'
```

## Réponses en flux (streaming) + mémoire

- **Streaming** : quand le widget envoie `stream: true`, `/api/chat` répond en **SSE**
  (`text/event-stream`) avec trois types d'événements : `meta` (`{ sources, lang }`, une fois),
  `delta` (`{ t }`, un ou plusieurs morceaux), `done` (`{ mode }`, une fois). En mode génératif,
  les morceaux sont relayés **au fil de l'eau** depuis le LLM (`llm.streamGenerate`). Les cas non
  génératifs (repli, interdit, extractif) renvoient le même contrat en **un seul** `delta`.
  Sans `stream`, la réponse reste du **JSON** classique (non-cassant).
- **Mémoire** : le serveur est **sans état**. Le widget renvoie `history` = les derniers tours
  (`[{ role:'user'|'assistant', content }]`), bornés (6 tours, 600 car.). Ils sont insérés dans le
  prompt LLM (`llm.buildMessages`) entre le système et la question courante. L'historique est
  traité comme du contenu **non fiable** (le prompt système garde la consigne anti-détournement).
- **Repli en cascade côté widget** : flux SSE → (si indisponible) réponse JSON → (si absent)
  réponses de démonstration scriptées. L'assistant répond donc **toujours**, sans coupure.
- **Hôte** : le streaming utilise `res.write()` (Node brut) — fonctionne sur Vercel Functions et
  Azure App Service. `X-Accel-Buffering: no` désactive la mise en tampon d'un proxy. Sur un plan à
  faible timeout (Vercel Hobby ~10 s), le streaming aide : les premiers mots arrivent avant le mur.

## Migration Azure

- `api/chat.js`, `rag.js`, `llm.js` sont du Node brut CommonJS `(req,res)`, sans dépendance :
  ils tournent tels quels sur Azure App Service (une route par handler) ou derrière un mince
  adaptateur Azure Functions. Voir `docs/migration-vrai-environnement.md`.
- Le fournisseur LLM se swappe par variables d'env (section Option B). Le service de test
  (Groq) est **jetable** : rien ne le couple au code.
- La base de connaissances (`kb.json`) est un simple fichier — elle suit le dépôt partout.

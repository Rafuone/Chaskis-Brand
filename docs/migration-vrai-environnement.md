# Migration vers le vrai environnement (passation dev)

## En clair (pour Alexandre)

L'hébergement actuel (Vercel + le dépôt GitHub `Rafuone/Chaskis-Brand`) est **un banc d'essai
temporaire**, le temps de prouver que les outils fonctionnent. **La cible réelle est Azure
(Azure DevOps / Azure App Service ou Azure Functions), PAS Vercel.** Le code est écrit exprès
pour être host-agnostic : l'objectif est une intégration Azure en **heures, pas en mois**.
Ce document liste, pour les devs, le peu qu'il reste à faire.

Principe : **seul l'hébergement est jetable, pas le travail.**

## Stable (ne change pas en migrant) vs jetable (à re-pointer)

**STABLE — l'interface, on n'y touche pas :**
- Le contrat de contenu `site-content.json` : schéma dans `docs/schema/site-content.md`,
  validateur unique `api/_lib/content-schema.js` (`validateContent`).
- Le lecteur public `assets/js/content.js` (fail-silent : si le contenu publié est absent,
  le site garde ses valeurs par défaut).
- L'éditeur `admin/` et le bouton Publier (`publishNow()` dans `admin/js/editor.js`).
- La convention des Functions : **CommonJS, réponse Node brute, zéro dépendance npm,
  zéro `package.json`, zéro build.**

**JETABLE — à re-pointer sur le vrai environnement :**
- L'hébergeur (aujourd'hui Vercel).
- Le stockage du contenu (aujourd'hui : un commit sur GitHub via l'API Contents).
- Les variables d'environnement.
- La mesure d'attente de la clé de publication (aujourd'hui : champ + `sessionStorage`,
  à remplacer par l'auth réelle — chantier `auth`, Clerk).

## Checklist de migration (le « presque rien à faire »)

1. **Servir le site statique** depuis le vrai host (n'importe quel serveur statique ou CDN).
   Aucun build à lancer, ce sont des fichiers HTML/CSS/JS bruts.
2. **Faire tourner le dossier `/api`** sur le vrai host (voir la section Azure ci-dessous) :
   les handlers sont du CommonJS Node brut `(req, res)` (modules natifs Node 18+ : `crypto`,
   `fetch` global), sans dépendance. `tools/api-server.js` les fait DÉJÀ tourner sur un serveur
   Node nu (testé hors Vercel) — c'est la preuve de portabilité et la base pour Azure App Service.
3. **Définir les variables d'environnement** côté serveur (jamais côté navigateur) :
   `PUBLISH_SECRET`, puis, selon le stockage choisi, `GITHUB_TOKEN` / `GITHUB_REPO` /
   `GITHUB_BRANCH`.
4. **Choisir le stockage du contenu** :
   - Garder GitHub comme stockage : re-pointer `GITHUB_REPO` / `GITHUB_BRANCH` / `GITHUB_TOKEN`
     vers le vrai dépôt. Rien d'autre à faire.
   - OU remplacer l'écriture : dans `api/publish.js`, **seule la partie « écriture »** (le PUT
     vers l'API GitHub, étapes 5-6 du fichier) est à remplacer par l'écriture vers le vrai
     CMS / base / fichier. Tout le reste (auth Bearer, validation via le contrat, réponses
     d'erreur 400/401/409/502) se réutilise tel quel. **Le client (bouton Publier) ne change
     pas.**
5. **Remplacer la clé de publication d'attente par l'auth réelle** (chantier `auth`, Clerk) :
   le POST enverra un jeton de session au lieu de la clé en `sessionStorage`. Point unique à
   changer côté client : l'en-tête `Authorization` construit dans `publishNow()`
   (`admin/js/editor.js`).
6. **Pointer `content.js` sur la bonne URL** de `site-content.json` si elle n'est pas à la
   racine web (une seule ligne : le `fetch('/site-content.json')`).

## Concrètement pour Azure (la cible réelle)

Les Functions ne dépendent QUE de Node (signature `(req,res)`, `fetch`/`crypto` natifs, zéro
dépendance). Deux chemins :

**Option A — Azure App Service (Node), le plus rapide et recommandé.** `tools/api-server.js` est
déjà un serveur Node qui sert le statique ET route `/api/<nom>` vers `api/<nom>.js`. Sur App
Service : déposer le dépôt, ajouter un `package.json` minimal
(`{ "scripts": { "start": "node tools/api-server.js" } }`, Node 18+), définir les variables
d'environnement, démarrer. C'est tout. **Handlers inchangés** (testé hors Vercel en local :
health 200 / auth 401 / validation 400).

**Option B — Azure Functions.** Un mince adaptateur par endpoint (quelques lignes qui passent
`request` → `(req, res)`) suffit, **sans toucher à la logique** des handlers. L'Option A évite
même cet adaptateur.

**Le seul vrai « Vercel-isme » = routage + en-têtes.** `vercel.json` (URLs propres + en-têtes
`no-store` / `X-Robots-Tag` sur `/admin` et `/api`) se retranscrit en `staticwebapp.config.json`
(Azure Static Web Apps) ou `web.config` / règles URL Rewrite (App Service/IIS) — ou est déjà
géré par `tools/api-server.js`. C'est de la **configuration, pas du code**.

**Variables d'environnement Azure** (App Service « Configuration » / Functions « Application
settings ») : `PUBLISH_SECRET`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` — exactement les
mêmes que sur Vercel.

## Comptes et services externes : test ≠ définitif

Les comptes créés pour tester (Clerk, Umami, Groq, Calendly…) sont **jetables** : ce ne seront
pas les comptes finaux, et le **service** lui-même peut changer à l'arrivée sur Azure. Chaque
service est donc branché **derrière une couture fine** :
- **Secrets par variables d'environnement** → changer de compte = re-saisir une clé, rien d'autre.
- **Appels isolés dans un endpoint / adaptateur** → changer de service = remplacer cet adaptateur,
  sans toucher à l'éditeur, au site, ni au contrat de contenu.

Équivalents Azure-natifs probables pour les versions finales (à privilégier le moment venu) :
- Auth (test : Clerk) → **Entra ID / Azure AD B2C**, ou l'auth intégrée d'Azure Static Web Apps.
- Chatbot LLM (test : Groq) → **Azure OpenAI**.
- Analytics (test : Umami) → **Application Insights** ou un `/api/collect` maison (la mesure sans
  cookie déjà en place peut l'alimenter).
- Stockage du contenu (test : dépôt GitHub) → **Azure Repos** (Azure DevOps) ou **Azure Blob**.
- Rendez-vous (test : Calendly) → Calendly conservé, ou **Microsoft Bookings** (M365).

Règle : **ne jamais coupler dur à un SaaS.** Chaque intégration doit être remplaçable seule.

## Ce qui garantit la portabilité

- Aucun `package.json`, aucune dépendance npm, aucun build : rien à reconstruire, rien qui
  casse à cause d'une version d'outil.
- Le **contrat de contenu est la seule interface** entre l'éditeur et le site public : tant
  qu'il est respecté, chaque morceau (hébergeur, stockage, authentification) est remplaçable
  **indépendamment** des autres.
- Les endpoints `/api/*` sont des fonctions isolées et sans état : elles se déplacent une par
  une.

## État au moment de l'écriture (2026-07-13)

- **Prouvé de bout en bout sur le banc d'essai Vercel (Preview)** : publication réelle
  (`api/publish.js`), historique (`api/history.js`) et restauration (`api/restore.js`) —
  auth Bearer, validation via le contrat, écriture/lecture GitHub. Le bouton Publier et la
  vue Versions (historique + restauration) fonctionnent depuis l'admin.
- **Portabilité prouvée** : `tools/api-server.js` (Node nu, zéro dépendance) fait tourner les
  `/api` hors Vercel (testé). C'est la base d'intégration Azure App Service.
- Auth GitHub en `Bearer` + `.trim()` des variables d'env (compatible PAT classic ET
  fine-grained ; tolère un espace collé par erreur).
- Non fait (attend un choix / des accès) : la bascule sur Azure, l'auth Clerk (remplace la clé
  de publication), et les chantiers analytics / perf (PageSpeed) / chatbot / calendly / media.

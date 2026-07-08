# Migration vers le vrai environnement (passation dev)

## En clair (pour Alexandre)

L'hébergement actuel (Vercel + le dépôt GitHub `Rafuone/Chaskis-Brand`) est **temporaire**,
le temps de prouver que tout fonctionne de bout en bout. **Rien n'est verrouillé à cet
hébergement** : le code a été écrit exprès pour être déplaçable presque sans effort.
Ce document liste, pour les devs, le peu qu'il reste à faire pour passer sur le vrai serveur.

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
2. **Faire tourner le dossier `/api`** sur le vrai host :
   - Vercel / Netlify Functions : tel quel.
   - Serveur Node maison (Express/Fastify…) : les handlers sont du CommonJS n'utilisant que
     des modules natifs de Node 18+ (`crypto`, `fetch` global). Monter
     `module.exports = async (req, res) => …` sur la route `POST /api/publish`.
     Rien à `npm install`.
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

## Ce qui garantit la portabilité

- Aucun `package.json`, aucune dépendance npm, aucun build : rien à reconstruire, rien qui
  casse à cause d'une version d'outil.
- Le **contrat de contenu est la seule interface** entre l'éditeur et le site public : tant
  qu'il est respecté, chaque morceau (hébergeur, stockage, authentification) est remplaçable
  **indépendamment** des autres.
- Les endpoints `/api/*` sont des fonctions isolées et sans état : elles se déplacent une par
  une.

## État au moment de l'écriture (2026-07-08)

- Fait et vérifié en local : contrat + validateur, lecteur `content.js` (câblé sur les 5 pages
  publiques), Function `api/publish.js` (auth + validation + écriture GitHub, testée par
  harness mocké), bouton Publier câblé (`publishNow()`, 7 cas d'erreur gérés).
- En cours : test de bout en bout sur un déploiement **Preview** Vercel (branche
  `feat/foundation-vercel`), isolé du site de production, avant toute bascule.
- Non fait (attend un choix / des accès) : le vrai environnement d'hébergement, l'auth Clerk,
  et les chantiers analytics / perf (PageSpeed) / chatbot / calendly / media.

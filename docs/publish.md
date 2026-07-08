# Chantier « Publication » — état et activation (passation dev)

Objectif : le contenu édité dans `admin/editor.html` atteint le site public via un fichier
`site-content.json` versionné dans Git (le push redéploie). Aucun secret côté navigateur.

## Ce qui est fait (branche `feat/foundation-vercel`)

1. **Contrat** — `api/_lib/content-schema.js` : `validateContent()` (allowlist stricte,
   rejet des balises HTML / `javascript:` / dataURL > 2 Ko / clés `__proto__` / NaN, taille
   max 300 Ko). Doc du schéma : `docs/schema/site-content.md`.
2. **Lecteur public** — `assets/js/content.js` : au chargement, `fetch('/site-content.json')`
   (no-store), fusionne les i18n dans `window.T` + `window.CHASKIS_PRICING`, puis rappelle
   `applyI18n`. **Strictement fail-silent** : fichier absent/illisible → la page garde ses
   valeurs par défaut. Câblé sur les 5 pages publiques standard (pas `app.html`).
3. **Écriture serveur** — `api/publish.js` (POST `/api/publish`) : auth `Bearer PUBLISH_SECRET`
   en temps constant, `validateContent`, GET du SHA + PUT base64 via l'API GitHub Contents,
   `409` si édition concurrente, timeout 8 s. Testé par harness (fetch mocké) : 405/401/400/
   create/update/409/504/500.
4. **Payload** — `exportDraftBundle()` dans `admin/js/editor.js` agrège tout l'état de l'admin.
5. **`site-content.json`** — V0 vide committé à la racine (aucun contenu publié pour l'instant).

## Ce qu'il reste à faire (nécessite Alexandre / les devs)

1. **Variables d'environnement Vercel** (Production + Preview) :
   - `PUBLISH_SECRET` (généré `openssl rand -hex 24`)
   - `GITHUB_TOKEN` (PAT fine-grained, **Contents: write** sur CE dépôt uniquement, expiration 90 j)
   - `GITHUB_REPO` (`owner/repo`), `GITHUB_BRANCH` (`main`)
2. **Câbler le bouton Publier** (`openPublish`/`publishVersion` dans `admin/js/editor.js`) :
   après le versioning local, construire le payload (base `exportDraftBundle()`, forme du
   schéma) et `await fetch('/api/publish', {method:'POST', headers:{Authorization:'Bearer '+SECRET,
   'Content-Type':'application/json'}, body:...})`. États loading/succès/erreur ; le brouillon
   localStorage reste intact tant que la publication n'a pas réussi.
3. **Où mettre `PUBLISH_SECRET` côté admin** (décision) : mesure d'attente (champ + sessionStorage)
   OU mini `api/session.js` posant un cookie httpOnly après mot de passe. Ne JAMAIS hardcoder
   le secret dans un fichier servi au navigateur. Solution finale = l'auth Clerk (chantier `auth`).
4. **Tester en local** : `vercel dev` (pas `tools/dev_server.py`, qui ne sert pas `/api`).
5. **Réconcilier le modèle de brouillon** : `PAGE` est figé à `"index"` (`STORE_KEY`) alors que
   l'éditeur gère 6 pages (`EDIT_PAGES`) ; à aligner pour publier réellement par page.

## Sécurité

Les valeurs publiées passent par `validateContent` (côté serveur) avant écriture. Côté rendu,
`content.js` applique via `applyI18n` (textContent pour `data-i18n`, innerHTML pour
`data-i18n-html` — d'où l'importance du filtre anti-balises du validateur).

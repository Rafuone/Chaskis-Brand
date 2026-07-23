# Chantier « Publication » — état et exploitation (passation dev)

Objectif : le contenu édité dans `admin/editor.html` atteint le site public via un fichier
`site-content.json` versionné dans Git (chaque publication = 1 commit, le push redéploie).
Aucun secret côté navigateur en dur.

## État : FONCTIONNEL de bout en bout (branche `feat/foundation-vercel`)

La publication a été vérifiée en ligne sur la préversion (un clic « Publier » dans l'éditeur
écrit un vrai commit de `site-content.json` sur la branche via l'API GitHub, et le site se
redéploie).

1. **Contrat** — `api/_lib/content-schema.js` : `validateContent()` (allowlist stricte ;
   rejet de toute balise HTML, `javascript:`, `data:text/html`, dataURL > 2 Ko, clés
   `__proto__`/`prototype`/`constructor`, `NaN`/`Infinity` ; taille max ~300 Ko ; sections
   allowlistées : `pricing`, `testimonials`, `logos`, `pages`, `chatbot`, `sections`). Doc : `docs/schema/site-content.md`.
2. **Lecteur public** — `assets/js/content.js` : au chargement, `fetch('/site-content.json')`
   (no-store), fusionne les i18n dans `window.T` + `window.CHASKIS_PRICING`, puis rappelle
   `applyI18n`. **Strictement fail-silent** : fichier absent/illisible → la page garde ses
   valeurs par défaut. Câblé sur les 5 pages publiques standard (pas `app.html`).
3. **Écriture serveur** — `api/publish.js` (POST `/api/publish`) : auth par **jeton de session
   Clerk** (vérifié serveur via JWKS) OU `PUBLISH_SECRET` en repli (comparaison temps constant),
   puis **RBAC** — la capacité `editor.publish` est exigée, sinon **403** (voir `docs/auth-roles.md`).
   Ensuite `validateContent`, GET du SHA courant + PUT base64 via l'API GitHub Contents, `409` si
   édition concurrente, timeout borné. GitHub authentifié en **Bearer** (PAT fine-grained).
4. **Payload + bouton** — `buildSiteContent()` (admin/js/editor.js) produit le JSON conforme
   au contrat ; `publishNow()` l'envoie en `POST /api/publish` avec la clé stockée, gère
   loading/succès/erreur (401 efface la clé, 409 conflit, 501 aperçu local). Le brouillon
   localStorage reste intact tant que la publication n'a pas réussi.
5. **Historique / restauration** — `api/history.js` (liste les commits de `site-content.json`)
   et `api/restore.js` (revert propre : relit le contenu au commit choisi, revalide, réécrit
   en nouveau commit — jamais de réécriture d'historique). Voir la vue « Versions » de l'admin.
6. **`site-content.json`** — présent à la racine (contenu publié par l'éditeur).

## Variables d'environnement (voir aussi `README.md` et `.env.example`)

| Variable | Rôle |
|----------|------|
| `PUBLISH_SECRET` | clé partagée de l'API admin (générée `openssl rand -hex 24`) |
| `GITHUB_TOKEN` | PAT fine-grained, **Contents: write** sur CE dépôt uniquement |
| `GITHUB_REPO` | `owner/repo` |
| `GITHUB_BRANCH` | branche cible (`main` en prod ; `feat/foundation-vercel` en test) |

Sur Vercel, un changement de variable ne prend effet qu'au **prochain déploiement**.

## Tests

`tools/publish.test.js` couvre le chemin d'écriture avec l'API GitHub **mockée** (aucun
réseau) : méthode refusée, auth manquante/erronée, JSON invalide, schéma refusé, création
(pas de SHA) vs mise à jour (SHA), conflit `409`, timeout. `tools/schema.test.js` couvre le
validateur (cas passant + rejets : balise HTML, `javascript:`, clé hors allowlist, pollution
de prototype). Lancer l'ensemble : `node tools/test.js`.

## Où stocker la clé côté admin

Interim assumé : la clé de publication vit dans le `localStorage` du navigateur admin (saisie
une seule fois). Ne JAMAIS la coder en dur dans un fichier servi au navigateur. **Évolution
finale = l'authentification (chantier `auth`, cible Entra ID / Azure AD B2C)**, qui supprimera
ce stockage. Avant mise en service réelle, fermer aussi l'XSS d'attribut de l'admin (voir la
revue de sécurité) : la clé en localStorage n'est exfiltrable que par ce biais.

## Sécurité

Les valeurs publiées passent par `validateContent` (côté serveur) avant écriture. Côté rendu,
`content.js` applique via `applyI18n` (textContent pour `data-i18n`, innerHTML pour
`data-i18n-html` — d'où l'importance du filtre anti-balises du validateur). Le texte des
sources chatbot publiées est PUBLIC (lisible dans `site-content.json`) : n'y mettre aucune
donnée confidentielle.

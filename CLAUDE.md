# Chaskis Brand — instructions projet

Site vitrine statique (HTML/CSS/JS vanilla, **sans build**) + back-office sur-mesure `admin/editor.html` (POC local). Déployé sur Vercel (effectivement en dev, non critique).
Lancer : `lancer-editeur.bat` ou `python tools/dev_server.py 3000` → http://localhost:3000/admin (ou tout serveur statique servi depuis la racine).

## Architecture (refonte juillet 2026)

Pages publiques (`index`, `mobilite`, `postuler`, `commander`, `dashboard`) = **markup uniquement**. Elles lient, dans cet ordre :

- **CSS partagé** : `assets/css/base.css` (tokens `:root` + reset + boutons) → `chrome.css` → `layout.css` → `components.css` → `chatbot.css`, puis `assets/css/pages/<page>.css` (spécifique à la page, gagne par ordre de source). L'`@import` des polices est en tête de `base.css`. Les `url()` des `pages/*.css` sont en **absolu** (`/assets/…`) car ce dossier descend d'un niveau.
- **JS partagé** : `assets/js/utils.js` (`window.CK` : escapeHtml, debounce) → `assets/js/shared.js` → `assets/js/auth.js` → `assets/js/pages/<page>.js`. Les dicts i18n de page sont dans `assets/js/i18n/<page>.js` (chargés **avant** shared.js, exposent `window.T`).

`shared.js` **injecte le chrome** (nav + menu mobile + footer), gère l'i18n (`T_BASE` + `window.T` fusionnés via `getDict`/`applyI18n`), la PWA et le Service Worker. Chaque page ne porte qu'un conteneur vide : `<nav id="nav" data-chrome-nav data-active="livraison|mobilite|postuler" [data-menu-extra="1"]>` et `<div class="mob-m" id="mm" data-chrome-menu>`. La promo (index) et `#pageCurtain` restent **statiques** (pré-paint anti-CLS). Le Service Worker est **opt-in** via l'attribut `data-sw` sur `<html>` (posé sur index + dashboard uniquement).

`app.html` = mini-PWA de suivi, **design system autonome** assumé (classes `.app-*`/`.oc-*`, pas de collision) ; CSS/JS dans `assets/css/pages/app.css` + `assets/js/pages/app.js`.

Back-office **décomposé** : markup dans `admin/editor.html`, styles dans `admin/css/editor.css`, **données** du plan dans `admin/data/tech-plan.js` (`window.CHASKIS_ADMIN.TECH_PLAN` / `.TECH_CROSS`), logique dans `admin/js/editor.js`. Les assets admin sont référencés en **absolu** (`/admin/…`) pour fonctionner sous `/admin` (dev) comme `/admin/editor.html` (prod). L'éditeur charge les pages du site dans une iframe : le chrome injecté par `shared.js` (synchrone) y est présent à temps.

## Release : quoi mettre à jour à CHAQUE commit (automatique, sans que l'utilisateur le redemande)

Dès que l'utilisateur demande de **committer** (ou dit « mets à jour les versions »), faire d'abord TOUTES ces mises à jour, PUIS committer. Emplacements (grep le nom de la constante pour la localiser précisément) :

1. **Version de l'app** — `ADMIN_BUILD.version` dans `admin/js/editor.js` : SemVer (patch `x.y.Z` = correctifs seuls ; minor `x.Y.0` = fonctionnalités).
2. **Date du plan** — `TECH_UPDATED` dans `admin/js/editor.js` : date du jour « J mois AAAA ».
3. **Notes de version** — `RELEASE_LOG` dans `admin/js/editor.js` : ajouter une entrée EN TÊTE avec `cur:true`, RETIRER `cur:true` de la précédente. Format `{ v:"vX.Y.Z", cur:true, date:"AAAA-MM-JJ", title:"…", items:[{t:"add|fix|imp", x:"phrase lisible par le client"}] }`.
4. **Avancement** — `PROGRESS` dans `admin/js/editor.js` : mettre à jour `stage`/`version` des pages modifiées.
5. **Plan de faisabilité** — `TECH_PLAN` dans `admin/data/tech-plan.js` (les données) et `TECH_EFF_DAYS` dans `admin/js/editor.js` : refléter l'avancement, réduire l'effort restant.
6. **Contrôle** — valider la syntaxe JS : `node --check admin/js/editor.js && node --check admin/data/tech-plan.js` (une apostrophe non échappée dans une chaîne single-quote casse le fichier). Puis committer sur `main`. **Ne jamais `git push`** sauf demande explicite.

## Conventions

- Écrire en français. Pas de tirets cadratins (—). Pas de libellés en MAJUSCULES.
- UI maison stylée à l'identité (jamais de select/modale natifs gris). Modale = croix de fermeture en haut à droite.
- Loi de proximité : label collé à sa valeur (~3px), blocs nettement séparés (~16px). Mesurer les espacements réels dans le navigateur, ne pas se fier au CSS écrit.
- Préfixes de classe uniques par composant. `admin/js/editor.js` conserve des **collisions connues** (`.pg-item` défini 3×, `.goal`, `.now`, `.switch`) à résoudre au fil de l'eau (couplées aux templates `innerHTML`, à renommer CSS + JS dans le même commit).
- Vérifier les changements dans le navigateur via les outils de preview avant de conclure.

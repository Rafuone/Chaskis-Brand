# Chaskis Brand — instructions projet

Site vitrine statique (HTML/CSS/JS vanilla, sans build) + back-office sur-mesure `admin/editor.html` (POC local, non pushé).
Lancer : `lancer-editeur.bat` ou `python tools/dev_server.py 3000` → http://localhost:3000/admin

## Release : quoi mettre à jour à CHAQUE commit (automatique, sans que l'utilisateur le redemande)

Dès que l'utilisateur demande de **committer** (ou dit « mets à jour les versions »), faire d'abord TOUTES ces mises à jour dans `admin/editor.html`, PUIS committer. Ne pas attendre qu'il précise quoi mettre à jour.

1. **Version de l'app** — constante `ADMIN_BUILD.version` : incrémenter en SemVer (patch `x.y.Z` = correctifs seuls ; minor `x.Y.0` = nouvelles fonctionnalités).
2. **Date du plan** — constante `TECH_UPDATED` : date du jour au format « J mois AAAA » (ex. « 4 juillet 2026 »).
3. **Notes de version** — tableau `RELEASE_LOG` : ajouter une entrée EN TÊTE avec `cur:true`, et RETIRER `cur:true` de l'entrée précédente. Format : `{ v:"vX.Y.Z", cur:true, date:"AAAA-MM-JJ", title:"...", items:[{t:"add|fix|imp", x:"phrase en langage humain, lisible par le client"}] }`. `add` = nouveauté, `fix` = correctif, `imp` = amélioration.
4. **Avancement** — tableau `PROGRESS` : mettre à jour le `stage` / `version` des pages modifiées ; ajouter une entrée `{view,name,env,stage,version,recent}` si une nouvelle page apparaît.
5. **Plan de faisabilité** — `TECH_PLAN` (et l'estimation `TECH_EFF_DAYS`) : si un chantier a avancé, refléter le nouvel état et réduire l'effort restant. L'estimation « reste à intégrer » doit baisser au fil du développement.
6. **Contrôle** : après chaque édition programmatique, VALIDER la syntaxe JS (extraire chaque `<script>` inline et `new Function(code)`), car une apostrophe non échappée dans une chaîne single-quote casse toute la page. Puis committer sur `main`. **Ne jamais `git push`** sauf demande explicite (POC local).

## Conventions

- Écrire en français. Pas de tirets cadratins (—). Pas de libellés en MAJUSCULES.
- UI maison stylée à l'identité (jamais de select/modale natifs gris). Modale = croix de fermeture en haut à droite.
- Loi de proximité : label collé à sa valeur (~3px), blocs nettement séparés (~16px). Mesurer les espacements réels dans le navigateur, ne pas se fier au CSS écrit.
- Préfixes de classe uniques par composant (des classes bare comme `.goal`, `.now`, `.pg-*` existent déjà et provoquent des collisions `display:flex`).
- Vérifier les changements dans le navigateur via les outils de preview avant de conclure.

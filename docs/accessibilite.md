# Accessibilité & SEO — pages publiques

Suivi de la passe qualité accessibilité (WCAG) et SEO technique sur les pages publiques.
Issu d'un audit multi-pages (index, mobilité, postuler, commander, dashboard).

## Fait (v0.26.1)

Correctifs **invisibles** (aucun changement de rendu) + 2 bugs de correction :

- **index.html** — libellés du simulateur reliés à leurs curseurs (`for`/`id` : simVol,
  simCost, simBasket, simComm). `<title>` raccourci (~78 → 54 caractères).
- **mobilite.html** — noms accessibles (`aria-label`) sur les boutons à glyphes du
  sélecteur date/heure (mois précédent/suivant, +/- heure et minutes). Meta description
  raccourcie (~197 → 147 caractères).
- **postuler.html** — textes alternatifs des photos de témoignages 1 et 3 corrigés (ils
  étaient inversés par rapport aux noms affichés). Balise `</div>` manquante de la carte 2
  ajoutée (l'étiquette et le contenu étaient imbriqués à tort dans la photo).

Vérifié au navigateur : associations label→input effectives, `aria-label` présents,
structure DOM des cartes cohérente, 0 erreur console, aucune régression visuelle.

## Reste à faire (backlog, plus coûteux ou à vérifier au rendu)

### Fait (v0.27.1)

- **Rôles ARIA détournés** (postuler, `#rVolet`) : `role="tablist"`/`role="tab"`/
  `aria-selected` retirés (le comportement reposait déjà sur `is-active`) + ligne
  `setAttribute('aria-selected', …)` supprimée dans `assets/js/pages/postuler.js`. Vérifié :
  carrousel clic + clavier OK, 0 régression.
- **Mots rotatifs du H1** (mobilité) : `aria-hidden` géré par le rotateur — seul le mot
  affiché est exposé au lecteur d'écran (`assets/js/pages/mobilite.js`).

### Fait (v0.27.2)

- **Landmark `<main id="content">`** ajouté sur index, mobilité, postuler (contenu principal
  entre la nav et le footer) + **lien d'évitement** clavier `.sr-only-focusable` (« Aller au
  contenu ») en 1er élément focusable de chaque page. CSS de révélation au focus dans
  `assets/css/base.css` (`.sr-only-focusable:focus`, `!important` pour surcharger `.sr-only`).
  Vérifié : main présent, lien = 1er focusable, 0 régression visuelle, 0 erreur console.
  (Le rendu visuel du lien au focus se déclenche au vrai focus clavier — non capturable en
  focus programmatique dans un navigateur automatisé, mais la règle CSS est en place.)
- Cache-buster des assets unifié à `?v=20260713b` sur toutes les pages.

### Reste à faire

Priorité décroissante :

1. **Accordéons FAQ** (index, mobilité, postuler) : `aria-expanded` (basculé par le JS) +
   `aria-controls` vers le panneau de réponse. Touche le JS d'ouverture des FAQ.
3. **Rotateur de signature** (mobilité, `.sig-word`) : même traitement `aria-hidden` que le H1.
4. **Hiérarchie des titres** : mobilité (`<h4>` suivant un `<h2>` → `<h3>`) et index (noms
   d'offres en `<span>` → `<h3>`). Nécessite d'adapter le CSS pour garder l'apparence
   (donc à vérifier au rendu — pas invisible).

Chaque item est additif et sûr ; ils ont été différés pour garder la passe v0.26.1
strictement sans risque visuel.

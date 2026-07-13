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

Priorité décroissante :

1. **Landmark `<main id="content">`** autour du contenu principal (index, mobilité,
   postuler…) + **lien d'évitement** clavier (`sr-only` focusable) vers `#content`.
   Structurel : à vérifier qu'aucun sélecteur CSS `body > …` ne casse.
2. **Accordéons FAQ** (index, mobilité, postuler) : `aria-expanded` (basculé par le JS) +
   `aria-controls` vers le panneau de réponse. Touche le JS d'ouverture des FAQ.
3. **Rôles ARIA détournés** (postuler, `#rVolet`) : les témoignages portent
   `role="tablist"`/`role="tab"`/`aria-selected` sans motif d'onglets valide. Retirer ces
   rôles (le comportement repose déjà sur la classe `is-active`) et la ligne
   `setAttribute('aria-selected', …)` de `assets/js/pages/postuler.js`.
4. **Mots rotatifs du H1** (mobilité) : `aria-hidden="true"` sur les mots inactifs (via le
   JS de rotation) pour que le lecteur d'écran n'énonce pas la liste entière.
5. **Hiérarchie des titres** : mobilité (`<h4>` suivant un `<h2>` → `<h3>`) et index (noms
   d'offres en `<span>` → `<h3>`). Nécessite d'adapter le CSS pour garder l'apparence
   (donc à vérifier au rendu — pas invisible).

Chaque item est additif et sûr ; ils ont été différés pour garder la passe v0.26.1
strictement sans risque visuel.

# Testimonials Carousel — Debug log

Journal honnête des tentatives pour faire fonctionner le carousel infini des témoignages. À lire par le prochain qui va toucher cette section pour ne pas refaire les mêmes erreurs.

## Le besoin

Carousel horizontal infini des 4 cards de témoignages :
- Défilement continu, **jamais** de raccord visible
- Gap fixe de 20px entre toutes les cards, y compris au point de reset
- Fonctionne sur toute résolution (FHD, 2K, 4K, 8K et au-delà)
- Vitesse de lecture confortable (~50–60 px/sec, ~6s pour qu'une card passe)

## Le pattern de référence

Fourni par l'utilisateur dans `Infinite/` (source Ryan Mulligan, "The Infinite Marquee" + variante StackOverflow) :

```html
<div class="marquee"> <!-- overflow:hidden -->
  <ul class="marquee__content">...</ul>
  <ul aria-hidden="true" class="marquee__content">...</ul>
</div>
```

```css
.marquee__content {
  flex-shrink: 0;
  display: flex;
  justify-content: space-around;
  min-width: 100%;
  animation: scroll ... linear infinite;
}
@keyframes scroll {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100% - var(--gap))); }
}
```

## Ce qui échoue et pourquoi

### Tentative 1 — Pattern Ryan à l'identique

`min-width:100%` + `justify-content:space-around` + `translateX(calc(-100% - gap))`.

**Problème** : `space-around` distribue l'espace restant entre les cards. Avec 4 cards de 340px dans un viewport 4K (3840px), chaque card se retrouve avec **400–600px de gap** entre elles. Visuellement inacceptable.

### Tentative 2 — Retirer `space-around`, garder `min-width:100%`

Cards collées à gauche du set, gap fixe 20px via flex-gap, `min-width:100%` pour garantir la largeur.

**Problème** : sans `space-around`, les 4 cards (1360px de contenu) n'occupent qu'une fraction du `min-width:100%` (3840px). Il reste **2480px de vide à droite du set**, visible comme un énorme trou au raccord set0→set1.

### Tentative 3 — Flex-gap `20px` + duplication JS

Dupliquer les 4 cards assez de fois pour que chaque set dépasse le viewport naturellement.

**Problème 1** : `gap` (flex gap) met de l'espace **entre** les items, mais **pas après le dernier**. Donc au raccord entre la dernière card du set0 et la première du set1, le gap était `0 + padding parent` ou faussé par un `calc(-100% - gap)` imprécis. Résultat : un décalage visuel de 10–20px au reset.

**Problème 2** : j'ai mis `overflow:hidden` sur `.testi-mq` ET un `width` implicite, ce qui faisait clipper les sets à la largeur du viewport AVANT que l'animation ne puisse les faire translater. Résultat : écran vide (premier screenshot catastrophique).

### Tentative 4 — `width:max-content` sur `.testi-mq` et `.testi-set`

Pour lever le clip prématuré.

**Problème** : j'avais toujours `min-width:100%` qui causait des interactions étranges avec `width:max-content`. Le browser calculait une largeur de set déconnectée de son contenu réel. Résultat : encore du vide en 4K.

### Tentative 5 — Hardcoder 5 puis 8 copies

Pour couvrir 4K–8K sans calcul.

**Problème 1** : 32 cards par set = 11520px, duration 230s. L'utilisateur a râlé (à raison) : sur-ingénierie inutile.

**Problème 2** : même avec 32 cards, un screenshot de l'utilisateur montrait encore un trou. Cause probable : cache navigateur + JS qui ne s'était pas rechargé.

## La solution actuelle (non-définitive)

Pattern StackOverflow simplifié (confirmé par l'utilisateur comme référence) :

```css
.testi-mq { display: flex; overflow: hidden; }
.testi-set {
  flex-shrink: 0;
  display: flex;
  animation: testi-scroll <dynamic>s linear infinite;
}
.testi-set .tc { margin-right: 20px; }  /* gap uniforme via margin, pas flex-gap */
@keyframes testi-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}
```

```javascript
// Duplication adaptative selon viewport
const ROUND_W = 1440; // 4 cards × 360px
const reps = Math.max(3, Math.ceil((window.innerWidth + 800) / ROUND_W));
// Duration calée sur vitesse ~60 px/sec
const duration = Math.round(setW / 60);
```

**Pourquoi ça devrait marcher** :
- `margin-right` sur CHAQUE card (y compris la dernière) → gap de 20px partout, **y compris au raccord** entre la dernière card de set0 et la première de set1
- `translateX(-100%)` sur chaque set → chaque set translate exactement de sa propre largeur, set1 prend la place de set0 pixel-parfait
- `overflow:hidden` sur `.testi-mq` clip correctement parce que `.testi-set` a `flex-shrink:0` et peut déborder

**Au 2026-04-17 l'utilisateur voit encore un trou sur son écran**. Causes possibles non confirmées :
1. Cache navigateur qui sert toujours l'ancien CSS/JS (hard refresh non fait)
2. `window.innerWidth` pas stable au moment du chargement initial
3. Un autre bug CSS/layout que je n'ai pas identifié

## Leçons pour la suite

1. **Ne pas interpréter, copier exactement le pattern de référence fourni.** Quand l'utilisateur donne un code qui marche, ne pas essayer de le "transformer" pour satisfaire une autre contrainte — demander d'abord comment concilier les deux.

2. **`gap` flex vs `margin-right` : pas pareil au raccord.** `gap` ne produit pas d'espace après le dernier enfant. Pour un marquee infini, utiliser `margin-right` sur chaque item.

3. **Ne jamais mettre `overflow:hidden` sur un flex container qu'on veut faire déborder via transform.** Mettre le clip sur un wrapper parent.

4. **Ne pas combiner `min-width:100%` et `flex-shrink:0` et `overflow:hidden` sans savoir exactement ce qu'on fait.** Les interactions sont fragiles.

5. **Tester à plusieurs résolutions dès le départ.** `window.innerWidth` peut varier selon scaling DPR, moment du chargement, etc. Prendre une marge confortable dans le calcul de duplication.

6. **Parler clairement à l'utilisateur AVANT de coder.** J'ai fait 10+ itérations silencieuses en pensant à chaque fois avoir compris. Il aurait fallu, à la première frustration, expliquer le trade-off (`space-around` qui étire VS `gap fixe + duplication`) et demander lequel choisir.

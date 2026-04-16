# Testimonials Carousel — Debug log

Journal des tentatives pour faire fonctionner le carousel infini des témoignages. Résolu le 2026-04-17 avec une architecture single-track. À lire avant de toucher cette section.

## Le besoin

Carousel horizontal infini des 4 cards de témoignages :
- Défilement continu, **jamais** de raccord visible
- Gap fixe de 20px entre toutes les cards, y compris au point de reset
- Fonctionne sur toute résolution (FHD, 2K, 4K, 8K et au-delà)
- Vitesse de lecture confortable (~50–60 px/sec, ~6s pour qu'une card passe)
- Pause au hover pour permettre la lecture

## Le pattern de référence initial

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

## Tentatives échouées

### Tentative 1 — Pattern Ryan à l'identique

`min-width:100%` + `justify-content:space-around` + `translateX(calc(-100% - gap))`.

**Problème** : `space-around` distribue l'espace restant entre les cards. Avec 4 cards de 340px dans un viewport 4K (3840px), chaque card se retrouve avec **400–600px de gap** entre elles. Visuellement inacceptable.

### Tentative 2 — Retirer `space-around`, garder `min-width:100%`

Cards collées à gauche du set, gap fixe 20px via flex-gap, `min-width:100%` pour garantir la largeur.

**Problème** : sans `space-around`, les 4 cards (1360px) n'occupent qu'une fraction du `min-width:100%` (3840px). Il reste **2480px de vide à droite du set**, visible comme un énorme trou au raccord set0→set1.

### Tentative 3 — Flex-gap `20px` + duplication JS

Dupliquer les 4 cards assez de fois pour que chaque set dépasse le viewport naturellement.

**Problème 1** : `gap` (flex gap) met de l'espace **entre** les items, mais **pas après le dernier**. Donc au raccord entre la dernière card du set0 et la première du set1, le gap était `0`. Résultat : décalage visuel au reset.

**Problème 2** : `overflow:hidden` sur `.testi-mq` ET un `width` implicite ont fait clipper les sets à la largeur du viewport AVANT que l'animation ne puisse les faire translater. Résultat : écran vide.

### Tentative 4 — `width:max-content` sur `.testi-mq` et `.testi-set`

Pour lever le clip prématuré. **Problème** : interactions étranges avec `min-width:100%`, largeur de set déconnectée du contenu. Encore du vide en 4K.

### Tentative 5 — Hardcoder 5 puis 8 copies

Pour couvrir 4K–8K sans calcul. **Problème** : sur-ingénierie (32 cards, 230s), et le trou persistait à cause d'un cache navigateur.

### Tentative 6 — `margin-right` sur chaque card + `translateX(-100%)`

Utiliser `margin-right: 20px` sur chaque `.tc` pour avoir un gap uniforme même au raccord.

**Problème identifié** : `set.offsetWidth` d'un conteneur flex **n'inclut pas** le `margin-right` du dernier enfant. Avec 12 cards × (340 + 20) attendu = 4320, mais `offsetWidth = 4300`. Donc `translateX(-100%)` translatait de 4300px au lieu de 4320 → au raccord, les cards se **touchaient** (gap 0) pendant que les internes avaient 20px. "Raccord" visible.

### Tentative 7 — Flex `gap` + `calc(-100% - var(--testi-gap))` (corrigeait le raccord)

CSS :
```css
.testi-mq{--testi-gap:20px;display:flex;gap:var(--testi-gap);overflow:hidden}
.testi-set{gap:var(--testi-gap);animation:testi-scroll 180s linear infinite}
@keyframes testi-scroll{to{transform:translate3d(calc(-100% - var(--testi-gap)),0,0)}}
```

Vérifié mathématiquement : seam = 20px à toutes les phases (0, 10%, 25%, 50%, 75%, 90%, 99.99%) en 1280px ET 3840px.

**Nouveau problème** : "au bout d'un moment, ça marche plus". Après plusieurs minutes, un **énorme trou** apparaissait. Cause : **désync entre `set0` et `set1`** au fil du temps. Deux animations CSS séparées sur deux éléments distincts dérivent (arrondis sub-pixel au compositeur, couches GPU indépendantes). Chaque frame rajoute une micro-erreur, et après des centaines de cycles, les deux sets sont décalés de plusieurs centaines de pixels.

## La solution définitive (2026-04-17) — single-track

**Architecture** : **un seul élément animé**, contenu périodique, shift d'exactement une période.

### CSS (`index.html:351-354`)

```css
.testi-mq{display:flex;overflow:hidden}
.testi-set{flex-shrink:0;display:flex;gap:20px;will-change:transform}
.testi-mq:hover #testiSet0{animation-play-state:paused}
#testiSet1{display:none}
```

- `testiSet1` caché (legacy DOM)
- Pause au hover ciblée par ID pour battre la spécificité de la règle d'animation injectée

### JS (`index.html:2113-2145`)

```js
const GAP = 20;
const CARD_W = 340;
const CARD_STEP = CARD_W + GAP;               // 360
const UNIT_STEP = CARDS.length * CARD_STEP;   // 4 × 360 = 1440 (une "période" de contenu)
const SPEED = 60;                              // px/s

function build() {
  const vw = window.innerWidth;
  const unitsNeeded = Math.ceil((vw + UNIT_STEP) / UNIT_STEP) + 1; // buffer
  track.innerHTML = Array.from({length: unitsNeeded}, () => CARDS.map(makeCard).join('')).join('');
  const duration = Math.max(20, Math.round(UNIT_STEP / SPEED));
  styleEl.textContent =
    '@keyframes testi-scroll-dyn{from{transform:translate3d(0,0,0)}to{transform:translate3d(-' + UNIT_STEP + 'px,0,0)}}' +
    '#testiSet0{animation:testi-scroll-dyn ' + duration + 's linear infinite}';
}
build();
window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(build, 200); });
```

### Pourquoi c'est mathématiquement seamless

1. **Un seul élément animé** → impossible d'avoir deux animations qui dérivent l'une par rapport à l'autre
2. **Travel en pixels explicites** : `translate3d(-1440px, 0, 0)` — pas de `-100%`, pas de `calc()`, pas de `var()` dans les keyframes
3. **Shift = une période exacte du contenu** : le track est `[ML PD SB FR][ML PD SB FR]...`. Translater par `-1440px` (= 4 cards × 360px) déplace le contenu d'exactement une période. Reset invisible.
4. **Buffer garanti** : `unitsNeeded = ceil((vw + UNIT_STEP) / UNIT_STEP) + 1` → le track couvre toujours viewport + 1 unité

### Preuves empiriques

- Seam mesuré à 7 phases du cycle (0, 10%, 25%, 50%, 75%, 90%, 99.99%) à 1280/1920/3840px → gap entre cards **toujours 20px**
- Simulation `currentTime = 3600s` (150 cycles) → visible frame **pixel-identique** à phase 0
- `match: true` entre snapshot à t=0 et snapshot à t=100 cycles

### Durée d'animation

La durée ne dépend plus de la largeur du set — elle est fixe : `UNIT_STEP / SPEED = 1440 / 60 = 24s`. Vitesse perçue identique à toute résolution.

## Leçons pour la suite

1. **`offsetWidth` d'un flex container ne compte pas le `margin-right` du dernier enfant.** Si tu animes en `-100%`, tu manques ce margin et tu as un raccord. Utilise flex `gap` + pixels explicites.

2. **Deux animations CSS sur deux éléments dérivent avec le temps.** Sub-pixel rounding + compositing GPU → micro-erreurs cumulatives. Sur des cycles longs, la dérive devient visible (plusieurs centaines de pixels après quelques minutes).

3. **Pour un marquee infini : un seul track, contenu périodique, shift d'une période exacte.** C'est la SEULE architecture qui garantit l'absence de drift.

4. **Les CSS variables dans les `@keyframes` fonctionnent, mais les pixels explicites sont plus debuggables.** Quand un bug visuel apparaît, avoir une valeur numérique qu'on peut lire dans les devtools aide énormément.

5. **Ne pas mettre `overflow:hidden` sur un flex container qu'on veut faire déborder via transform.** Mettre le clip sur un wrapper parent (ici `.mq-w`).

6. **Attention à la spécificité quand on injecte du CSS dynamique.** `#testiSet0{animation:...}` (spec 1,0,0) écrase `.testi-mq:hover .testi-set{animation-play-state:paused}` (spec 0,2,1). Il faut monter la spécificité du pause à `.testi-mq:hover #testiSet0` (spec 1,2,0).

7. **Tester la durée réelle, pas juste la géométrie.** Le raccord géométrique peut être parfait à t=0 mais le drift temporel peut le casser. Simuler `currentTime = N * duration` avec N élevé est le bon test.

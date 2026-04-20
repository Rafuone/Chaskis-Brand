# Image Prompts for Chaskis Website

> **Dernière mise à jour :** 19 avril 2026
> **État actuel des sections :**
> - `nav` (Navigation) — desktop : logo + liens centrés + toggle FR/EN + burger. **Mobile (≤768px) : toggle FR/EN déplacé dans le burger menu** (`.mob-lang`), la navbar mobile ne contient plus que logo + burger (plus de `space-around` qui cassait l'hiérarchie). `movePill` et `setLang` parcourent `.lang-sw` (plusieurs instances) au lieu de `#langSw` seul.
> - `diff-sec` (Pourquoi Chaskis) — utilise des icônes Lucide pour le moment. Des illustrations dans un style "dessiné / Notion" sont prévues pour chaque card (voir section dédiée ci-dessous).
> - `feat-sec` (Tout est inclus) — mockup UI codé à droite (suivi de livraison avec preuve photo), bénéfices listés à gauche avec icônes sur fond pastel (teal-bg, accent-bg). Copy adapté B2B : intégration outils (Shipday/API), pas "pas de logiciel". Sémantique SEO : h3, article, JSON-LD DeliveryService. **Animation du mockup : les étapes "Commande reçue · 14:08" et "Coursier assigné · 14:10" sont pré-cochées dès le début du cycle** (animation démarre direct à phase 2, Point A en cours). Raison : les phases 0-1 (waiting / assigned) étaient trop courtes et donnaient l'impression d'un état vide à l'entrée du viewport.
> - `sim-sec` (Simulateur d'économies) — repositionnée juste avant le booking pour renforcer le funnel de conversion. Dernier nudge avant le CTA. **Intro reformulée** : ancien texte "30 % de marge perdue avec les plateformes à commission" incohérent avec notre modèle (tarif fixe par course, pas commission %). Nouveau texte axé "commissions + frais cachés + majorations variables". **Layout colonne gauche** : liste collée au sous-texte (`margin:0`), CTA éloigné (`margin-top:32px`). **Résultat** : bloc "Offre recommandée" avec badge coloré dynamique — Dédié vert `#4ADE80`, Flex bleu `#93C5FD`, Express jaune `#FDE047`. Sous-texte du résultat réduit à `.7rem`. Logique JS inchangée (paliers : <10 Express CHF 16, <40 Flex CHF 12, ≥40 Dédié CHF 8, économie = (actuel − chaskis) × vol × 22j).
> - `cta-booking` (Booking) — refonte complète façon Calendly : layout 2 colonnes (calendrier + créneaux), gradient violet→teal pour les sélections (au lieu du vert pur, plus accessible), première date disponible pré-sélectionnée au chargement. Colonne gauche orientée conversion : badge urgence "Prochain créneau le…", h2 "Votre consultation logistique offerte" (mots forts : conseil stratégique, audit, expert), checklist valeur (audit coûts, reco tarifaire, plan de déploiement clé en main), mini témoignage. Flow 4 étapes : date/heure → infos → vos économies (optionnel, contextualisé) → confirmation. **Mobile : les créneaux horaires utilisent maintenant un `grid repeat(3,1fr)` au lieu de `flex:1 + flex-wrap`** — l'ancien layout laissait le 5ème créneau (16:30) seul sur sa ligne, étiré à 100% par `flex:1`.
> - `faq` (FAQ) — **contact mis en avant** : email `hello@chaskis.ch` et téléphone `+41 22 700 01 27` en `font-weight:700`. Adresses des bureaux (Genève, Lausanne) dans une classe `.faq-ci-addr` avec `opacity:.3` pour les reléguer visuellement — ce sont des infos secondaires vs les canaux de contact actifs.

## Audit de l'ordre des sections (avril 2026)

Ordre actuel du funnel :
1. Hero — accroche + CTA
2. Partners — crédibilité immédiate (60+ entreprises, stats)
3. `diff-sec` — pourquoi Chaskis (3 cards 3D)
4. `feat-sec` — ce que ça change (5 bénéfices + mockup map)
5. `offres` — pricing (Flex / Dédié / Express)
6. `testi` — témoignages (social proof)
7. `how` — onboarding 4 étapes
8. `mob-sec` — Mobilité ⚠️ casse le funnel, à déplacer après FAQ ou sur page dédiée
9. `sim-sec` — simulateur d'économies
10. `cta-booking` — réservation 4 étapes
11. `faq` — objections
12. Footer

## Code mort à nettoyer
CSS + i18n existants mais jamais rendus : `.zoom-section`, `.proof-sec`, `.secteurs`, `.vp`, `.pipeline`, `.bento`, `.recruit`. ~15-20KB de dead code à purger.

---

Use these prompts in Midjourney, DALL-E, or Ideogram to generate photos for the site. Style: authentic, warm, diverse, urban Swiss setting (Lausanne/Geneva vibes). Shot on professional camera, natural light, shallow depth of field.

---

## Homepage

### Hero (hero-photo)
**Prompt:** Portrait of a young smiling bike courier in a teal branded uniform, standing with their delivery bike on a cobblestone street in Lausanne Switzerland, golden hour light, warm tones, professional photography, shallow depth of field, looking at camera confidently, urban European backdrop with old buildings, 3:4 aspect ratio

### Value Prop Cards (3 images)
**1. "Moins cher" card:**
**Prompt:** Close-up of a small restaurant owner smiling behind their counter, receipt or tablet in hand showing an order, warm ambient lighting, cozy European bistro setting, authentic feel, 4:3 aspect ratio

**2. "Des humains" card:**
**Prompt:** Group of 3-4 diverse bike couriers and drivers standing together laughing, wearing matching teal polo shirts, urban European street, team spirit, genuine emotion, professional photography, 4:3 aspect ratio

**3. "Fiabilité suisse" card:**
**Prompt:** A courier carefully handling a package at a doorstep, handing it to a grateful customer, clean Swiss residential neighborhood, precision and care visible in body language, warm natural light, 4:3 aspect ratio

### How It Works section
**Prompt:** Bird's-eye view of a bike courier riding through a clean Swiss city center, teal-colored delivery bag visible on back, cyclists lanes, pedestrians, beautiful urban landscape, 16:9 aspect ratio

### Testimonials section (3 avatars)
**1.** Professional headshot of a woman in her 40s, friendly, European, restaurant manager type, warm lighting, neutral background
**2.** Professional headshot of a man in his 50s, distinguished, pharmacist or doctor type, glasses, warm lighting
**3.** Professional headshot of a young woman, 30s, tech/e-commerce startup CEO type, confident, modern

### About/Pourquoi Chaskis section
**Prompt:** Wide shot of the Chaskis team (15-20 diverse people) gathered in front of a modern office or warehouse in Switzerland, mix of couriers in teal shirts and office staff, genuine smiles, group photo energy, Swiss flag or Alps subtly in background, professional photography, 16:9 aspect ratio

---

## Recruitment Page (postuler.html) — REFONTE avril 2026

> Refonte complète : 1 seule image hero (format portrait 4:5) à la place du collage IA répétitif précédent. Ajout d'un badge iridescent CSS (conic-gradient) avec "97% satisfaction équipes" en overlay sur la hero. Les 2 métiers (coursier / chauffeur) sont en cartes descriptives côte à côte, sans images dans la v1. La page ne contient plus qu'une seule image. D'autres images viendront plus tard si besoin.

### postuler-hero.png (unique image de la page)
**Fichier :** `postuler-hero.png` · **Ratio :** 4:5 (portrait, 520×650 environ) · **Placement :** colonne droite du hero, avec badge iridescent en overlay top-right

**Prompt :** Authentic editorial photograph of a Chaskis bike courier in action, three-quarter rear view (not facing camera), insulated delivery backpack visible on shoulders, teal Chaskis branded uniform, riding through a narrow cobblestone street in old-town Geneva or Lausanne, late afternoon golden hour light, warm bokeh of European stone buildings and soft street lamps in the background, candid reportage style, no people in foreground, no group shots, no repeated faces, shallow depth of field on the courier, motion subtle, 35mm film look, natural colors, cinematic yet realistic, 4:5 portrait ratio.

**Anti-patterns (ne pas faire) :**
- Pas de collage multi visages, pas de foule dupliquée
- Pas de regard caméra
- Pas de style 3D ou illustration
- Pas d'arrière plan urbain générique (éviter New York, Paris, Tokyo — c'est Genève ou Lausanne)

### Badge iridescent (CSS-only, pas d'image)
Implémenté directement en CSS avec `conic-gradient` + animation de rotation (voir `.iri-badge` dans postuler.html). Couleurs pastel holographiques : rose, bleu pervenche, menthe, jaune pâle, lavande, pêche. Contenu : "97%" en gradient purple→teal, label "Satisfaction équipes" en dessous.

### postuler-role-coursier.png (carte métier coursier)
**Fichier :** `postuler-coursier.png` · **Ratio :** 3:4 ou 4:5 (portrait) · **Placement :** `.r-role.r-coursier .r-role-bg` (background-image cover)

**Prompt :** Editorial portrait photograph, young female bike courier in a teal Chaskis branded jacket, seated on the edge of a wooden bench outside a small Geneva café in the morning, her delivery bike with an insulated bag leaning against the wall behind her, hands wrapped around a takeaway coffee cup, soft natural diffuse morning light from the side, shallow depth of field, looking slightly off-camera with a warm relaxed expression, no direct eye contact, cobblestone ground, old-town European facade out of focus, documentary 35mm film feel, not posed, not stock-photo.

### postuler-role-chauffeur.png (carte métier chauffeur)
**Fichier :** `postuler-chauffeur.png` · **Ratio :** 3:4 ou 4:5 (portrait) · **Placement :** `.r-role.r-chauffeur .r-role-bg` (background-image cover)

**Prompt :** Cinematic side-window portrait of a Chaskis professional driver behind the wheel of a modern dark delivery van, hands gently on the steering wheel, focused calm expression looking at the road ahead (profile or 3/4 view, never looking at camera), soft daylight coming through the side window creating highlights on the shoulder, mid-buste framing, realistic interior of the van slightly visible, Geneva urban street reflections on the side window, understated and premium, documentary realism, shallow depth of field, no stock-photo cliché.

**Anti-patterns communs (coursier + chauffeur) :**
- Pas de sourire forcé ni regard caméra direct
- Pas de pose "bras croisés devant un van"
- Pas de fond new-yorkais, parisien ou tokyoïte : c'est Genève ou Lausanne
- Pas de collage ni de visages dupliqués
- Cohérence visuelle : les deux portraits doivent se répondre par la lumière et le cadrage (mêmes tons chauds, même grain, complémentaires sans être identiques)

### Interviews : 3 portraits individuels (section "Les voix du terrain")

> Format 4:5 portrait, grand, un portrait par personne. Les trois doivent se répondre visuellement (même palette lumineuse, même grain) sans être identiques. Priorité à l'authenticité reportage, pas stock-photo.

### postuler-itv-pierre.png (Pierre, coursier Genève)
**Prompt :** Documentary portrait of a 27 year old male bike courier named Pierre, athletic build, short dark hair, standing outside in a Geneva cobblestone street mid-morning, wearing the teal Chaskis cycling uniform, arms relaxed, leaning slightly against his delivery bike, confident calm expression looking just off-camera, soft cloudy daylight, shallow depth of field, European old-town background out of focus, honest reportage feel, 4:5 portrait ratio, not stock-photo.

### postuler-itv-amelia.png (Amélia, chauffeure Lausanne)
**Prompt :** Documentary portrait of a 31 year old female professional driver named Amélia, warm friendly expression (not smiling big), standing next to an open Chaskis delivery van door in Lausanne, afternoon soft light, dark driver uniform, short wavy hair, looking slightly off-camera, arms loosely crossed, realistic and grounded, Lausanne lake or urban backdrop heavily blurred, documentary 35mm feel, 4:5 portrait ratio.

### postuler-itv-abdel.png (Abdel, coursier Genève)
**Prompt :** Documentary portrait of a 34 year old male courier named Abdel, warm direct but calm expression, teal Chaskis jacket, standing in a small Geneva square late afternoon, golden hour light on the side of his face, vertical framing, delivery bag on shoulder, bike partially visible behind, no smile forced, natural reportage, shallow depth of field, 4:5 portrait ratio.

### postuler-itv-nadia.png (Nadia, chauffeure Nyon)
**Prompt :** Documentary portrait of a 29 year old female professional driver named Nadia, warm and focused expression, standing beside a Chaskis delivery van in a Nyon parking area midday, dark driver uniform, curly medium hair tied back loosely, slight three-quarter profile looking toward the vehicle, natural daylight from overhead, realistic and grounded, Alps or lake faintly suggested in the background, shallow depth of field, 4:5 portrait ratio, not stock-photo.

### postuler-itv-karim.png (Karim, coursier Lausanne)
**Prompt :** Documentary portrait of a 23 year old male bike courier named Karim, energetic but calm expression, teal Chaskis jersey, leaning against his bike on a Lausanne slope with the lake visible in the bokeh behind him, early afternoon bright cloudy light, looking slightly off-camera with a quiet confidence, no forced smile, delivery bag on the handlebars, 35mm film feel, shallow depth of field, 4:5 portrait ratio.

### postuler-itv-valentina.png (Valentina, coursière Riviera)
**Prompt :** Documentary portrait of a 36 year old female bike courier named Valentina, serene and grounded expression, teal Chaskis jacket, seated on a low stone wall along the Riviera lakefront (Vevey or Montreux), late morning soft light, bike leaning nearby, looking gently off-camera, soft water reflections out of focus behind her, honest reportage feel, no stock-photo cliché, 4:5 portrait ratio.

**Consistance entre les 6 interviews :** même tempérament photographique (documentaire doux, 35mm, profondeur de champ courte), temps de la journée varié pour éviter la redite, tenues Chaskis différentes selon rôle mais palette teal constante. Éviter tout sourire publicitaire.

---

## Commander Page

### Header illustration
**Prompt:** Flat illustration or 3D render of a delivery route with pin markers on a stylized map of Lausanne, teal and purple color scheme, clean modern design, isometric perspective, white background, used as decorative header, 16:9 aspect ratio

---

## Dashboard

No photos needed — uses avatars, icons, and data visualizations.

---

## Section "Pourquoi Chaskis" — diff-sec (illustrations futures)

> Ces 3 cards utilisent actuellement des icônes Lucide. Quand on passera aux illustrations, voici les prompts cibles. Style souhaité : dessiné, coloré, proche de Notion / Linear — pas de style undraw ou vecteur plat générique.

### Card 1 — Coursiers salariés, toujours au rendez-vous
**Prompt:** Illustration in a hand-drawn editorial style (similar to Notion or Linear blog illustrations), showing a confident bike courier in a teal uniform checking off a delivery on a phone screen, urban Swiss street in the background, warm earthy tones with teal accent, slightly playful but professional, white or transparent background, square format

### Card 2 — Tarif fixe, coût maîtrisé
**Prompt:** Hand-drawn editorial illustration of a simple price tag or receipt showing a clean fixed amount in Swiss Francs (CHF), with a satisfied business owner in the background, teal and purple accent tones, no hidden fees metaphor (e.g., no fine print, no asterisks), square format, white or transparent background

### Card 3 — Zéro coordination de votre côté
**Prompt:** Hand-drawn editorial illustration of a relaxed shop owner at their counter, phone in hand, while in the background a courier seamlessly picks up a package — no stress, no calls, no coordination shown, teal accents, warm tones, square format, white or transparent background

---

## General brand photos (reusable)

### Courier action shots (3 variants)
**1.** Courier on bike crossing a bridge in Lausanne, side view, motion, teal bag
**2.** Courier handing over a food delivery bag at a restaurant entrance, warm interior glow
**3.** Courier confirming a delivery at a doorstep, scanning or photographing the package for proof of delivery, urban Swiss setting, focused and professional expression

### Driver action shots (2 variants)
**1.** Driver loading boxes into a branded van trunk, careful handling, parking area
**2.** Driver at the wheel, smiling, dashboard GPS visible, clean car interior

### Office/tech (1 variant)
**Prompt:** Modern open office with a few people working on laptops, screens showing delivery dashboards and maps, Swiss startup vibe, plants, natural light, teal accent wall or furniture, 16:9 aspect ratio

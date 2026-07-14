# Performance — audit local + Core Web Vitals réels

## Deux niveaux

1. **Audit navigateur (déjà en place, gratuit, sans compte)** — le bouton « Relancer
   l'analyse » de la vue Performance parcourt les 5 pages et mesure le référencement
   (titres, meta, données structurées, plan du site), la lisibilité (alt, étiquettes,
   ordre des titres) et le poids. Aucune dépendance externe.
2. **Core Web Vitals réels (ACTIVÉ)** — `api/perf.js` mesure la vitesse perçue (LCP, CLS,
   TBT, score de performance) via Google PageSpeed Insights, **plus** les notes Lighthouse
   Accessibilité / SEO / Bonnes pratiques (même passage). Affiché dans le bloc « Vitesse
   réelle, mesurée par Google » de la vue Performance (bande des 4 notes + tuiles CWV +
   historique + reprise auto sur timeout). Le score de vitesse est aussi repris dans le
   pilier Rapidité quand l'accueil est mesuré.

## Endpoint `GET /api/perf`

- Paramètres : `url=<page http(s)>`, `strategy=mobile|desktop` (défaut mobile).
- Auth : `Authorization: Bearer <PUBLISH_SECRET>` (comme les autres endpoints).
- Réponse : `{ ok, url, strategy, score, categories:{ performance, accessibility, seo, bestPractices }, metrics:{ lcp, cls, tbt, fcp, si } }` (`score` = performance, rétrocompat).
- Sans `PAGESPEED_KEY` → `501` (l'admin garde son estimation). Sans `url` valide → `400`
  (utile comme sonde « clé active ? » sans consommer de quota PageSpeed).

## Activer

1. Créer une **clé API Google PageSpeed Insights** (gratuite) :
   https://developers.google.com/speed/docs/insights/v5/get-started
2. Variable d'environnement de l'hôte : `PAGESPEED_KEY = <la clé>`.
3. C'est tout côté serveur. Sur Vercel, un changement de variable ne prend effet qu'au
   **prochain déploiement** (pousser un commit ou « Redeploy »). L'affichage front est déjà
   branché (vue Performance).

## ⚠️ Timeout — point d'hébergement

PageSpeed est **lent** (souvent 10-30 s). Le plan **Vercel Hobby coupe les fonctions vers
~10 s** : l'appel PageSpeed y renverra souvent `504`. Cet endpoint est donc fiable sur un
hôte au timeout plus large :
- **Azure App Service / Functions (cible finale)** : timeout configurable → OK.
- Vercel Pro (`maxDuration` relevé) → OK.
- Alternative : un job planifié qui mesure les pages clés à intervalle régulier et stocke
  le résultat (évite l'appel synchrone dans la requête admin).

## Tester en local

```
node tools/perf.test.js                                   # endpoint + measure(), sans réseau
node tools/perf-cron.test.js                              # cron + store + history, sans réseau
PUBLISH_SECRET=x node tools/api-server.js 3199
curl -H 'Authorization: Bearer x' 'localhost:3199/api/perf?url=https://chaskis.ch'   # 501 tant que PAGESPEED_KEY absent
curl -H 'Authorization: Bearer x' 'localhost:3199/api/perf-cron'                     # mesure planifiée (manuel)
curl -H 'Authorization: Bearer x' 'localhost:3199/api/perf-history'                  # historique serveur
```

## Mesure planifiée + historique serveur

- **`GET /api/perf-cron`** — mesure PLANIFIÉE. Auth : `Authorization: Bearer <CRON_SECRET>`
  (Vercel Cron l'envoie si `CRON_SECRET` est défini) OU la clé admin `PUBLISH_SECRET`
  (déclenchement manuel). Mesure `PERF_CRON_PAGES` (défaut `/`) sur `PERF_SITE_URL` et **append**
  à l'historique serveur. Réutilise `perf.measure()` (même code que l'endpoint à la demande).
- **Planification** : `vercel.json` → `"crons": [{ "path": "/api/perf-cron", "schedule": "0 6 * * *" }]`
  (tous les jours 6 h UTC ; Hobby = 1/jour). Azure : timer trigger d'Azure Functions ou Logic App
  appelant la même route avec l'en-tête `CRON_SECRET`.
- **Historique serveur** (`api/_lib/perf-store.js`) — couture de stockage `PERF_STORE` :
  `github` (défaut si `GITHUB_TOKEN` : écrit `data/perf-history.json` dans le dépôt, durable et
  partagé, fenêtre glissante 90 entrées) · `memory` (éphémère) · `off`. Cible Azure : Blob/Table.
- **`GET /api/perf-history`** — lecture (capacité `perf.view`). L'admin (page Performance) l'affiche
  sous « Mesures automatiques (serveur) » ; repli **silencieux** vers l'historique local si absent.
- **Timeout** : PageSpeed est lent ; sur Vercel Hobby (~10 s) le cron ne mesure de façon fiable
  qu'**une** page (d'où le défaut `/`). Sur Azure (timeout large) on élargit via `PERF_CRON_PAGES`.

## Migration Azure

`api/perf.js` = Node brut CommonJS `(req,res)`, sans dépendance : tourne tel quel sur Azure
App Service. PageSpeed est une API Google appelée serveur → identique partout ; la clé reste
en variable d'environnement. La mesure planifiée = un timer Azure Functions/Logic App appelant
`/api/perf-cron` (en-tête `CRON_SECRET`) ; l'historique passe de GitHub à Azure Blob/Table via
`PERF_STORE` (même interface `perf-store.js`). Voir `docs/migration-vrai-environnement.md`.

# Performance — audit local + Core Web Vitals réels

## Deux niveaux

1. **Audit navigateur (déjà en place, gratuit, sans compte)** — le bouton « Relancer
   l'analyse » de la vue Performance parcourt les 5 pages et mesure le référencement
   (titres, meta, données structurées, plan du site), la lisibilité (alt, étiquettes,
   ordre des titres) et le poids. Aucune dépendance externe.
2. **Core Web Vitals réels (couture, à activer)** — `api/perf.js` mesure la vitesse
   perçue (LCP, CLS, TBT, score de performance) via Google PageSpeed Insights. C'est la
   seule mesure que l'audit navigateur ne peut pas faire.

## Endpoint `GET /api/perf`

- Paramètres : `url=<page http(s)>`, `strategy=mobile|desktop` (défaut mobile).
- Auth : `Authorization: Bearer <PUBLISH_SECRET>` (comme les autres endpoints).
- Réponse : `{ ok, url, strategy, score, metrics:{ lcp, cls, tbt, fcp, si } }`.
- Sans `PAGESPEED_KEY` → `501` (l'admin garde son estimation).

## Activer

1. Créer une **clé API Google PageSpeed Insights** (gratuite) :
   https://developers.google.com/speed/docs/insights/v5/get-started
2. Variable d'environnement de l'hôte : `PAGESPEED_KEY = <la clé>`.
3. C'est tout côté serveur. (Le branchement d'affichage dans la vue Performance — afficher
   les CWV réels à côté de l'audit local — est un petit ajout front à faire ensuite.)

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
node tools/perf.test.js                                   # 10 tests, sans réseau
PUBLISH_SECRET=x node tools/api-server.js 3199
curl -H 'Authorization: Bearer x' 'localhost:3199/api/perf?url=https://chaskis.ch'   # 501 tant que PAGESPEED_KEY absent
```

## Migration Azure

`api/perf.js` = Node brut CommonJS `(req,res)`, sans dépendance : tourne tel quel sur Azure
App Service. PageSpeed est une API Google appelée serveur → identique partout ; la clé reste
en variable d'environnement. Voir `docs/migration-vrai-environnement.md`.

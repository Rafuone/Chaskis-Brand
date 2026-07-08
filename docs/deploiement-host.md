# Activation du chantier « host » (Fondations Vercel)

Le code est en place sur la branche `feat/foundation-vercel`. Il ne peut devenir **réel en production** qu'avec quelques actions dans les dashboards Vercel/Git, que seul un membre de l'équipe peut faire. Voici la procédure exacte, dans l'ordre.

## Ce qui est déjà fait (code, vérifié en local)

- `api/health.js` — sonde de santé, route `/api/health`.
- `api/env-check.js` — prouve qu'un secret serveur est lu, sans exposer sa valeur.
- `api/_lib/content-schema.js` — validateur partagé du contenu publié (contrat central).
- `vercel.json` — rewrite `/admin` + en-têtes `X-Robots-Tag: noindex, nofollow` sur `/admin`, `/admin/(.*)`, `/api/(.*)`.
- `robots.txt` — `Disallow: /admin`.
- `sw.js` — ne s'occupe plus jamais de `/api`.
- `.gitignore` — ignore `node_modules`, `.env*`.

## Étape 1 — Outils locaux (une fois)

```bash
node -v                 # doit afficher v18 ou plus
npm i -g vercel         # CLI Vercel (npm n'est utilisé que pour ce CLI global)
vercel login            # compte membre de l'équipe Chaskis
cd /chemin/vers/Chaskis-Website
vercel link             # relie le dossier au projet Vercel (recrée .vercel/, déjà gitignoré)
```

## Étape 2 — Créer le secret de test `PING_TOKEN`

Dashboard Vercel > projet > Settings > Environment Variables. Créer :

| Nom | Valeur | Environnements |
|-----|--------|----------------|
| `PING_TOKEN` | une chaîne aléatoire quelconque (ex. `openssl rand -hex 16`) | **Production ET Preview ET Development** (cocher les trois) |

> Piège à éviter : si `PING_TOKEN` n'est défini qu'en Production, les déploiements Preview renverront `{present:false}` et on croira à tort que le mécanisme ne marche pas.

## Étape 3 — Tester en local avec `vercel dev`

`tools/dev_server.py` ne sait PAS exécuter les Functions (il renvoie maintenant un 501 explicite sur `/api`). Utiliser :

```bash
vercel env pull .env.local     # récupère PING_TOKEN en local (le fichier est gitignoré)
vercel dev                     # sert le statique + /api + les rewrites, port 3000
```

Puis vérifier :
- http://localhost:3000/api/health → `{ "ok": true, "service": "chaskis", "ts": "..." }`
- http://localhost:3000/api/env-check → `{ "present": true }`
- http://localhost:3000/admin → l'éditeur (rewrite `/admin` actif)

## Étape 4 — Déployer d'abord sur une Preview (jamais direct en prod)

```bash
git push origin feat/foundation-vercel   # Vercel crée un déploiement Preview automatique
```

Sur l'URL de preview `*.vercel.app` fournie par Vercel :

```bash
curl -s   https://<preview>.vercel.app/api/health       # 200 + JSON ok
curl -s   https://<preview>.vercel.app/api/env-check     # {"present":true}
curl -sI  https://<preview>.vercel.app/admin             | grep -i x-robots-tag   # noindex, nofollow
curl -sI  https://<preview>.vercel.app/admin/editor.html | grep -i x-robots-tag   # noindex, nofollow (les DEUX URLs)
curl -sI  https://<preview>.vercel.app/index.html        | grep -i cache-control  # no-store toujours là (pas de régression)
```

Vérifier aussi qu'aucune réponse ne contient la **valeur** de `PING_TOKEN`.

## Étape 5 — Mettre en production

Merger `feat/foundation-vercel` dans `main` (Vercel redéploie la prod automatiquement). Refaire les mêmes `curl` sur `https://www.chaskis.ch`.

> Note désindexation : `/admin` n'a jamais été indexé par Google (site de démo), donc `Disallow` + `X-Robots-Tag` suffisent. Si un jour une URL `/admin` avait été indexée, il faudrait laisser le crawl ouvert le temps que Googlebot lise le `X-Robots-Tag`, ou passer par l'outil de suppression d'URL de Search Console.

## Critères de « fait » (definition of done du plan)

- [ ] `/api/health` répond 200 avec le JSON attendu en prod.
- [ ] `/api/env-check` renvoie `{present:true}` avec le secret, `{present:false}` sans (preuve de lecture serveur).
- [ ] La valeur de `PING_TOKEN` n'apparaît dans aucune réponse ni aucun asset client.
- [ ] `curl -I /admin` ET `/admin/editor.html` renvoient `X-Robots-Tag: noindex, nofollow`.
- [ ] `robots.txt` en prod contient `Disallow: /admin`.
- [ ] Le service worker n'intercepte plus `/api`.
- [ ] Les pages publiques répondent toujours 200 avec `Cache-Control: no-store` intact.

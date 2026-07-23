# Intégration Azure — runbook développeur

> **But de ce document** : tout ce qu'un dev doit faire pour héberger ce projet sur **Microsoft Azure**.
> Vercel (actuel) n'est qu'un **banc d'essai**. Le code est **host-agnostique par conception** : la plupart
> des bascules se font **par variable d'environnement**, pas par réécriture. Ce fichier consolide les notes
> Azure éparpillées dans les autres docs (`migration-vrai-environnement.md`, `auth-roles.md`, `analytics.md`,
> `chatbot.md`, `perf.md`, `media.md`, `rdv-calendly.md`).

## 0. En bref (TL;DR)

- **Stack** : site statique + **12 handlers serverless** `(req, res)` Node natif, CommonJS, **0 dépendance npm**, pas de build. **Node 18+** requis (`fetch`, `crypto` JWK, `base64url`).
- **Chemin recommandé** : **Azure App Service (Node)** exécutant `tools/api-server.js` (sert le statique **et** `/api`, en-têtes inclus) → **handlers inchangés**.
- **Ce qui est déjà prêt pour Azure (bascule par ENV seule)** : stockage (adaptateur **Azure Blob** livré), **LLM Azure OpenAI**, RBAC, publication GitHub, perf/PageSpeed, analytics, Calendly.
- **Ce qui demande du vrai code Azure** : **l'authentification** (Clerk → Entra ID, un nouveau vérificateur à écrire) et le **cron** (timer Azure au lieu de Vercel Cron).

---

## 1. Architecture cible

### Option A — Azure App Service (Node) · **recommandée**
Un seul service sert le statique + `/api`. `tools/api-server.js` route déjà `/api/<nom>` → `api/<nom>.js`, applique les en-têtes de sécurité, les rewrites d'URLs propres et le cache. **Aucun handler à réécrire.**

1. Ajouter un `package.json` minimal (voir §3) et pointer le démarrage sur `node tools/api-server.js`.
2. App Service pose `PORT` (lu en `tools/api-server.js`) et doit poser `NODE_ENV=production` (active le cache des assets versionnés).
3. Déployer le repo (GitHub Actions ci-dessous), poser les variables d'env (§4), brancher le domaine.

### Option B — Azure Static Web Apps (SWA) + Functions
Le statique passe par SWA (qui lit **directement** `staticwebapp.config.json`, déjà présent et à jour). Mais les Functions managées SWA attendent le **modèle Azure Functions** (`context`/`request`) : chaque handler devrait recevoir un adaptateur, **ou** on lie une app Azure Functions séparée. Plus de travail que l'option A. Utiliser SWA pour le statique + une App Service/Functions séparée pour `/api` est possible mais A reste plus simple.

> Recommandation : **Option A**. Le reste de ce document la suit.

---

## 2. Déploiement (GitHub Actions → App Service)

Créer l'App Service (Linux, Node 20 LTS), récupérer son **publish profile** et le mettre dans le secret GitHub `AZURE_WEBAPP_PUBLISH_PROFILE`. Exemple de workflow `.github/workflows/azure-appservice.yml` :

```yaml
name: Deploy to Azure App Service
on:
  push:
    branches: [ main ]          # ou la branche de prod Azure
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: node tools/test.js   # la suite doit rester verte avant tout déploiement
      - uses: azure/webapps-deploy@v3
        with:
          app-name: <nom-de-votre-app-service>
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

**Commande de démarrage** App Service : `node tools/api-server.js` (via le `package.json` §3, ou dans Configuration → Startup Command). Zéro `npm install` utile (aucune dépendance).

---

## 3. `package.json` minimal (à ajouter pour Azure)

Non committé aujourd'hui **exprès** (éviter que Vercel change son mode de build). À ajouter pour le déploiement Azure :

```json
{
  "name": "chaskis-website",
  "version": "1.0.0",
  "private": true,
  "engines": { "node": ">=18" },
  "scripts": {
    "start": "node tools/api-server.js",
    "test": "node tools/test.js"
  }
}
```

---

## 4. Variables d'environnement — référence complète

Toutes les variables lues par le code (`process.env`). À poser dans **App Service → Configuration** (Production).

| Variable | Rôle | Requis ? | Note Azure |
|---|---|---|---|
| **Stockage** | | | |
| `STORAGE_PROVIDER` | `blob` \| `azure` \| `memory` \| `off` | oui pour Azure | **`azure`** |
| `AZURE_BLOB_SAS_URL` | URL conteneur + jeton SAS | oui (si azure) | voir §5 |
| `BLOB_READ_WRITE_TOKEN`, `BLOB_API_VERSION` | Vercel Blob | non | **abandonner** (spécifiques Vercel) |
| **Auth (admin)** | | | |
| `PUBLISH_SECRET` | clé de secours (Bearer admin) | recommandé | portable |
| `CLERK_PUBLISHABLE_KEY` | active l'auth Clerk | — | remplacé par Entra (§6) |
| `CLERK_ALLOWED_ORIGINS`, `CLERK_ALLOWED_SUBS` | allowlists azp / utilisateurs | prod | équivalents Entra |
| `CLERK_SECRET_KEY` | **déclaré mais jamais lu** | non | **ne pas reporter** |
| `CHASKIS_ROLES` | JSON `{ sub: rôle }` | — | mapper depuis groupes/app-roles Entra |
| `CHASKIS_DEFAULT_ROLE` | rôle par défaut | prod | portable |
| **Publication contenu** | | | |
| `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` | écrit `site-content.json` (API GitHub) | oui (publier) | portable (ou Azure Repos) |
| **LLM (chatbot)** | | | |
| `LLM_PROVIDER` | `azure-openai` | — | **déjà implémenté** |
| `LLM_BASE_URL` | `https://<ressource>.openai.azure.com` | si azure-openai | — |
| `LLM_MODEL` | **nom du déploiement** Azure OpenAI | — | — |
| `LLM_API_KEY`, `LLM_API_VERSION` | clé + version d'API | — | ex. `2024-02-15-preview` |
| **Perf / cron** | | | |
| `PAGESPEED_KEY` | Core Web Vitals (sinon 501) | non | portable |
| `CRON_SECRET` | Bearer de la mesure planifiée | — | envoyé par le timer Azure (§7) |
| `PERF_SITE_URL` | origine auditée (sinon 403) | prod | `https://www.chaskis.ch` |
| `PERF_STORE`, `PERF_TIMEOUT_MS`, `PERF_ALLOWED_HOSTS`, `PERF_CRON_PAGES` | réglages perf | non | timeout plus large sur Azure |
| **Divers** | | | |
| `CALENDLY_TOKEN`, `CALENDLY_OWNERS`, `CALENDLY_BUDGET_MS` | RDV (sinon 501) | non | portable (ou M365 Bookings) |
| `ANALYTICS_SALT`, `PING_TOKEN` | hash visiteur anonyme + sonde santé | recommandé | portable |
| `NODE_ENV`, `PORT` | cache assets + port | oui | posés par App Service |

> `x-vercel-forwarded-for` (IP client, `collect.js`/`crm.js`) n'existe pas sur Azure → derrière Azure Front Door, l'IP arrive dans `X-Azure-SocketIP` / `X-Forwarded-For` (impacte le comptage de visiteurs uniques et les limites de débit en mémoire).

---

## 5. Stockage — adaptateur Azure Blob (déjà livré)

`api/_lib/storage.js` a désormais un adaptateur **`azure`** (à côté de `blob`/`memory`/`off`), testé (`tools/storage.test.js`, section « azure »). Contrat REST conforme : `PUT` avec `x-ms-blob-type: BlockBlob`, `GET ?comp=list`, `DELETE`, `x-ms-version: 2021-08-06`.

**Configuration (une seule variable) :**
```
STORAGE_PROVIDER=azure
AZURE_BLOB_SAS_URL=https://<compte>.blob.core.windows.net/<conteneur>?sv=...&ss=b&srt=co&sp=racwdl&sig=...
```
Le SAS doit couvrir lecture + écriture + liste + suppression (`sp=racwdl`).

**Accès public/privé — important :** les médias (images servies au site) veulent des **URL lisibles sans SAS** → conteneur en **accès lecture publique au niveau blob**. Les **leads/clients** (privés) sont dans le même contrat : l'adaptateur **ajoute automatiquement le SAS** en lecture (`readUrl`), donc un conteneur **privé** fonctionne aussi. Choix recommandé : un conteneur médias public + (idéalement) un conteneur privé pour les leads. Si un seul conteneur privé est utilisé, les URL d'images publiques nécessiteront le SAS (à trancher selon la sensibilité).

> À valider contre un vrai compte Azure lors de l'intégration (le contrat REST est couvert par tests simulés, pas par un aller-retour réel). `crm.js` protège aujourd'hui les leads par un suffixe aléatoire dans un store public : sur Azure, préférer un **conteneur privé**.

---

## 6. Authentification — Clerk → Entra ID (vrai travail à faire)

C'est **le seul gros morceau non basculable par ENV.** `api/_lib/session.js` est **façonné pour Clerk** : `clerkFrontendApi()` déduit l'hôte JWKS du `pk_test|pk_live`, l'issuer est vérifié en égalité stricte.

À faire :
1. **Serveur** — ajouter une branche « vérificateur Entra » dans `session.js` : issuer `https://login.microsoftonline.com/<tenant>/v2.0`, `jwks_uri` via la découverte OIDC (`/.well-known/openid-configuration`), validation `aud`/`appid`, et mapping des rôles depuis les claims (`roles`/groupes) au lieu de `CHASKIS_ROLES`. Le RBAC (`api/_lib/rbac.js`) est **déjà host-neutre** : seule la source d'identité change.
2. **Client** — `admin/editor.html` charge aujourd'hui Clerk JS depuis le CDN Clerk et rafraîchit le jeton toutes les ~40 s ; remplacer par **MSAL.js** et étendre `api/config.js` (qui ne renvoie que `clerkPublishableKey`).
3. Conserver `PUBLISH_SECRET` comme **secours** (Bearer) pendant la bascule.

Cf. `docs/auth-roles.md` (§ cible Azure) et `docs/publish.md:58`.

---

## 7. Tâches planifiées (cron) — pas d'équivalent SWA

`vercel.json` déclare un cron quotidien `06:00 UTC` → `GET /api/perf-history?run=1`. **Aucune facilité cron côté SWA/App Service.** Provisionner un **Azure Functions Timer** ou une **Logic App** qui appelle :
```
GET https://www.chaskis.ch/api/perf-history?run=1
Authorization: Bearer <CRON_SECRET>
```
Poser `CRON_SECRET` **et** `PERF_SITE_URL` (sinon `403`). C'est la seule tâche planifiée du projet.

---

## 8. Autres coutures (rappel)

| Couture | Fichier | Cible Azure | Effort |
|---|---|---|---|
| LLM | `api/_lib/llm.js` | Azure OpenAI **déjà implémenté** | ENV seul |
| RBAC | `api/_lib/rbac.js` | mapping rôles Entra | ENV / config |
| Publication | `api/_lib/github.js` | garder GitHub **ou** Azure Repos | 0 (host-neutre) |
| Perf store | `api/_lib/perf-store.js` | Blob/Table via la couture | ENV |
| Analytics | `api/collect.js` + storage | App Insights ou Azure Table (même couture) | moyen |
| RDV | `api/calendly.js` / `availability.js` | garder Calendly **ou** M365 Bookings | ENV / futur |

---

## 9. Config d'hébergement

- `staticwebapp.config.json` (Azure SWA) est **à jour et en parité** avec `vercel.json` : mêmes 5 en-têtes de sécurité globaux, mêmes `noindex` sur `/admin` et `/api`, `no-store` sur les `.html`, exclusion des `.json` (donc `/site-content.json` est servi tel quel → le masquage de sections côté client fonctionne). `vercel.json` reste utile tant que Vercel sert de banc d'essai ; Azure ignore `vercel.json`.
- **Deep link de suivi** `/suivi/CODE` : rendu **host-neutre** — `app.js` lit désormais le code depuis le **chemin** (plus seulement `?code=`), donc la réécriture SWA `/suivi/* → /app.html` suffit.
- **Cache des assets** : garder la convention `?v=` (cache-bust par URL, host-agnostique) ; `NODE_ENV=production` active le cache long des assets côté `api-server.js`.

---

## 10. Pièges Azure (checklist)

- [ ] **Stockage** : conteneur **privé** pour les leads/clients (aujourd'hui protégés par simple suffixe aléatoire dans un store public). Poser `STORAGE_PROVIDER=azure` + `AZURE_BLOB_SAS_URL`.
- [ ] **Auth** : écrire le vérificateur Entra (§6) — Clerk ne bascule PAS par ENV. Ne pas reporter `CLERK_SECRET_KEY` (mort).
- [ ] **IP client** : lire `X-Azure-SocketIP`/`X-Forwarded-For` (pas `x-vercel-forwarded-for`) si le comptage visiteurs / rate-limit comptent.
- [ ] **Anti-abus dur** : les limiteurs en mémoire sont par-instance → ajouter des règles **Azure Front Door / WAF** sur les POST publics `/api/collect` et `/api/crm`.
- [ ] **Cron** : provisionner le timer Azure (§7).
- [ ] **Fraîcheur publish→chatbot** : `chat.js` lit `site-content.json` **sur le disque local** (cache mtime). Sur App Service, un commit GitHub ne rafraîchit pas l'instance sans re-déploiement CI/CD (ou lecture depuis le stockage). Prévoir que la publication déclenche un redéploiement, ou lire `site-content.json` depuis le Blob.
- [ ] **Domaine** : `www.chaskis.ch` + certificat TLS managé (apex + www). HSTS émis avec `preload` → engage HTTPS sur tous les sous-domaines.
- [ ] **`package.json`** : ajouté pour Azure (§3), commande de démarrage `node tools/api-server.js`, `NODE_ENV=production`.

---

## 11. Definition of Done (Azure)

1. `node tools/test.js` vert (15 suites) dans la CI avant déploiement.
2. App Service en ligne, `/` et une page profonde répondent, `/api/health` OK, `/api/health?probe=env` montre les variables attendues à `true`.
3. Upload média + inscription newsletter → visibles dans l'admin (stockage Azure OK).
4. Auth admin fonctionnelle (Entra) ; `PUBLISH_SECRET` de secours retiré une fois validé.
5. Cron perf planifié qui écrit son historique.
6. Domaine + HTTPS + en-têtes de sécurité vérifiés.

---

*Sources internes : `docs/migration-vrai-environnement.md` (doc cible faisant autorité), `docs/deploiement-host.md`, `docs/auth-roles.md`, `docs/analytics.md`, `docs/chatbot.md`, `docs/perf.md`, `docs/media.md`, `docs/rdv-calendly.md`. Ce runbook les consolide côté Azure — en cas de divergence, la cartographie du code (fichiers `api/_lib/*`) fait foi.*

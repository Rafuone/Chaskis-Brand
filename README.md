# Chaskis — site vitrine + back-office

Site vitrine **statique** (HTML / CSS / JS vanilla, **sans build, sans dépendance npm**) doublé
d'un back-office d'administration (`/admin`) et d'un dossier de **Functions serverless
host-agnostiques** (`/api`). Conçu pour une intégration **en heures, pas en jours** : rien à
compiler, rien à installer, secrets en variables d'environnement.

> Cible d'hébergement finale = **Azure** (App Service Node ou Azure Functions). Vercel n'est
> qu'un **banc d'essai**. Tout le code reste portable : voir `docs/migration-vrai-environnement.md`.

## Démarrer en local

Aucune installation (Node 18+ suffit, pour `fetch`/`crypto` natifs).

```bash
# Serveur unique qui sert le statique ET exécute /api (recommandé) :
node tools/api-server.js 3000
# → http://localhost:3000  (site)   ·   http://localhost:3000/admin/editor.html  (admin)

# Pour tester /api avec les secrets :
PUBLISH_SECRET=xxx GITHUB_TOKEN=xxx GITHUB_REPO=owner/repo GITHUB_BRANCH=main \
  node tools/api-server.js 3000
```

`tools/dev_server.py` (Python) sert **uniquement le statique** (pas `/api`) : pratique pour un
aperçu rapide du site, insuffisant pour l'admin (Publier/Perf/Calendly renverront une erreur).

## Tester

```bash
node tools/test.js        # lance toutes les suites tools/*.test.js (0 dépendance, 0 réseau)
```

**14 suites** dans `tools/*.test.js` : `perf`, `chat`, `calendly`, `publish`, `schema` (validateur
de contenu), `session`, `rbac`, `rbac-endpoints`, `history`, `restore`, `storage`, `media`,
`collect`, `test` (lanceur). Aucune ne touche le réseau (fetch/GitHub/PageSpeed/Blob sont mockés)
ni n'exige de clé.

## Architecture

```
Couche publique (statique, sans build)
  index / mobilite / postuler / commander / dashboard(noindex) / app(noindex, PWA)
  + pages légales (confidentialite / mentions-legales / cgv)
  CSS en couches : assets/css/ base → chrome → layout → components → chatbot → pages/<page>.css
  JS pipeline    : assets/js/ utils → shared (nav + i18n FR/EN + PWA) → auth → pages/<page>.js
  SEO / PWA      : robots.txt · sitemap.xml · manifest.json · sw.js

Back-office admin (SPA vanilla mono-page)
  admin/editor.html (coque + ~15 vues)  ·  admin/js/editor.js (état + rendu + appels /api)
  admin/css/editor.css  ·  admin/data/tech-plan.js (données du « Suivi technique »)

API / serverless host-agnostique (CommonJS (req,res), 0 dépendance, 0 build)
  Cœur     : health (+ ?probe=env) · publish · restore · history
  Features : perf (PageSpeed) · perf-cron · perf-history · chat (RAG + LLM optionnel) · calendly
             · media-upload (Blob) · collect (audience) · config
  api/_lib/: content-schema (contrat central) · storage (couture Blob→Azure) · rag · llm
             · calendly-map · assign · availability · github · http · auth · session · rbac · perf-store
  api/_data/: kb.json (base de connaissances seed du chatbot)
  NB : plan Vercel Hobby = 12 Serverless Functions max. env-check a été fusionné dans health
       (?probe=env) pour tenir dans cette limite ; sur Azure (pas de limite), on peut re-séparer.

Preuve de portabilité : tools/api-server.js exécute EXACTEMENT les mêmes handlers /api,
sans Vercel. C'est aussi la base d'un hébergement Azure App Service (Node).
```

**Conventions non négociables** (elles garantissent la portabilité) :
- Functions `/api` = **CommonJS**, signature Node brute `(req, res)` (`res.setHeader/statusCode/end`),
  **aucune dépendance npm**, **aucun `package.json`**, **aucun build**. `fetch`/`crypto` natifs (Node 18+).
- Dossiers `api/_lib` et `api/_data` (préfixe `_`) = exclus du routage, librairies/données partagées.
- Secrets **uniquement** en `process.env`, jamais en dur, jamais servis au navigateur.
- Chaque publication de contenu passe par le validateur unique `api/_lib/content-schema.js`.
- Données de **démo/seed** conservées comme repli tant qu'aucun backend n'est branché (le site
  reste riche sans configuration).

## Déploiement

| Cible | Fichier de config | Notes |
|-------|-------------------|-------|
| **Vercel** (banc d'essai) | `vercel.json` | rewrites URLs propres + en-têtes ; `/api/*.js` routés par fichier. |
| **Azure Static Web Apps** | `staticwebapp.config.json` | rewrites + en-têtes équivalents, **livré**. (Les `/api` demandent un mince adaptateur Azure Functions — voir migration.) |
| **Azure App Service (Node)** — *recommandé* | *aucun* | lancer `node tools/api-server.js` : il sert le statique ET les `/api`, en posant lui-même routing + en-têtes (`noindex` sur `/admin`+`/api`, `no-store` HTML). |

Le **seul** couplage à l'hébergeur = ce fichier de routage/en-têtes. La logique des handlers ne
change pas. Détails et checklist : `docs/migration-vrai-environnement.md`.

## Variables d'environnement

Voir `.env.example`. Toutes optionnelles : **une fonctionnalité non configurée se dégrade en
silence** (repli sur les données de démo / `501`), le site ne casse jamais.

| Variable | Chantier | Rôle |
|----------|----------|------|
| `PUBLISH_SECRET` | auth (repli) | clé partagée de l'API admin (Bearer), break-glass de l'auth Clerk. `openssl rand -hex 24`. |
| `CLERK_PUBLISHABLE_KEY` | auth | clé publique Clerk : charge Clerk côté client + dérive le JWKS pour vérifier les sessions. Seule variable Clerk lue par le code. |
| `CLERK_SECRET_KEY` | auth | standard Clerk ; **non utilisé** par la vérification manuelle par JWKS (réservé au SDK backend). Jamais exposé au client. |
| `CLERK_ALLOWED_ORIGINS` | auth | optionnel : origines autorisées pour le claim `azp` (défense CSRF), séparées par des virgules. |
| `CLERK_ALLOWED_SUBS` | auth | optionnel (recommandé) : identifiants utilisateurs Clerk (`sub`) autorisés, séparés par des virgules. Vide = toute session valide (restreindre alors les inscriptions côté Clerk). |
| `CHASKIS_ROLES` | auth (rôles) | attribution rôle←utilisateur, JSON `{"user_xxx":"editor","user_yyy":"commercial"}`. Rôles : `admin`, `commercial`, `leadcommercial`, `editor`. Un `sub` mappé à un rôle inconnu est **verrouillé** (aucun droit), jamais admin. Voir [docs/auth-roles.md](docs/auth-roles.md). |
| `CHASKIS_DEFAULT_ROLE` | auth (rôles) | rôle d'un utilisateur authentifié **non** listé dans `CHASKIS_ROLES`. Absent → `admin` (non-cassant). **Posture prod recommandée : le mettre à un rôle restreint** (ex. `commercial`) et lister les admins explicitement. Valeur invalide → verrouillé (fail-closed). |
| `GITHUB_TOKEN` | publish | PAT fine-grained, **Contents: write** sur ce dépôt. |
| `GITHUB_REPO` | publish | `owner/repo`. |
| `GITHUB_BRANCH` | publish | branche cible (`main` en prod). |
| `PAGESPEED_KEY` | perf | clé Google PageSpeed Insights (gratuite) → Core Web Vitals réels. |
| `CRON_SECRET` | perf (planifié) | secret Bearer envoyé par la tâche planifiée à `/api/perf-cron` (Vercel Cron l'envoie s'il est défini). Sans lui, la mesure planifiée n'est pas déclenchable (le déclenchement manuel par clé admin reste possible). |
| `PERF_SITE_URL` | perf (planifié) | origine du site à auditer par le cron (ex. `https://chaskis.ch`). **Seule origine fiable** ; sans elle, une origine dérivée d'un en-tête est refusée (403) sauf allow-list. |
| `PERF_ALLOWED_HOSTS` | perf (planifié) | hôtes autorisés (virgules) si `PERF_SITE_URL` absent — anti-abus (un détenteur de `CRON_SECRET` ne peut pas faire auditer un hôte arbitraire). |
| `PERF_CRON_PAGES` | perf (planifié) | pages auditées par passage, séparées par des virgules (défaut `/`). Élargir sur un hôte au timeout large (Azure). |
| `PERF_STORE` | perf (historique) | stockage de l'historique serveur : `github` (défaut si GITHUB_TOKEN présent, écrit `data/perf-history.json`), `memory` (éphémère), `off`. Cible Azure : Blob/Table. |
| `PERF_TIMEOUT_MS` | perf | optionnel : délai max d'un appel PageSpeed (ms). Défaut prudent pour les plans à faible timeout. |
| `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` | chatbot | fournisseur OpenAI-compatible (Groq / OpenAI / **Azure OpenAI**). Sans clé → mode extractif. |
| `LLM_BASE_URL` / `LLM_API_VERSION` | chatbot | requis pour Azure OpenAI (endpoint + version d'API). |
| `CALENDLY_TOKEN` | calendly | jeton API Calendly v2 (lecture des RDV). |
| `CALENDLY_OWNERS` | calendly | **liste** des noms de commerciaux (séparés par des virgules) pour la répartition, ex. `Sarah,Marc,Jean-Christophe`. Défaut : jeu de démo. |
| `CALENDLY_BUDGET_MS` | calendly | optionnel : budget de temps global de la synchro (ms). |
| `AVAILABILITY_PROVIDER` | calendly (Phase 2) | source de disponibilité agrégée (`none` par défaut). |
| `GOOGLE_CALENDAR_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_JSON` | calendly (Phase 2) | agenda Google agrégé (non activé). |
| `BLOB_READ_WRITE_TOKEN` | media + analytics | token du stockage d'objets (Vercel Blob, store **public**). Copié depuis l'onglet `.env.local` du store. Sans lui, stockage en repli `memory`. Cible Azure : Blob/Table. Voir [docs/media.md](docs/media.md) / [docs/analytics.md](docs/analytics.md). |
| `STORAGE_PROVIDER` | media + analytics | `blob` (défaut si token présent) \| `memory` (tests/local) \| `off`. |
| `BLOB_API_VERSION` | media + analytics | version d'API REST Blob (défaut `7`), surchargeable si Vercel la fait évoluer. |
| `ANALYTICS_SALT` | analytics | sel du hachage des visiteurs uniques (anonyme, rotatif par jour). Optionnel (repli `PING_TOKEN` puis constante). |
| `PING_TOKEN` | health | jeton de sonde de fondation (optionnel), lu par `/api/health?probe=env` (booléen seul). |
| `PORT` | local | port du serveur `tools/api-server.js` (défaut 3000/argument). |

`ANTHROPIC_API_KEY` n'est utilisée que par l'outil de traduction hors-ligne `tools/translate.js`
(non requis en production).

## Documentation détaillée

`docs/` — un fichier par chantier : `deploiement-host`, `migration-vrai-environnement`,
`publish`, `schema/site-content` (contrat de contenu), `auth-roles` (rôles & capacités serveur),
`chatbot`, `rdv-calendly`, `perf`, `media` (stockage Blob), `analytics` (collecteur maison),
`accessibilite`.

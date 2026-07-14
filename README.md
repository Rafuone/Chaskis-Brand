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

Suites : `perf`, `chat`, `calendly`, `publish`, `schema` (validateur de contenu). Aucune ne
touche le réseau (fetch/GitHub/PageSpeed sont mockés) ni n'exige de clé.

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
  Cœur     : health · env-check · publish · restore · history
  Features : perf (PageSpeed) · chat (RAG + LLM optionnel) · calendly
  api/_lib/: content-schema (contrat central) · rag · llm · calendly-map · assign · availability
  api/_data/: kb.json (base de connaissances seed du chatbot)

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
| `GITHUB_TOKEN` | publish | PAT fine-grained, **Contents: write** sur ce dépôt. |
| `GITHUB_REPO` | publish | `owner/repo`. |
| `GITHUB_BRANCH` | publish | branche cible (`main` en prod). |
| `PAGESPEED_KEY` | perf | clé Google PageSpeed Insights (gratuite) → Core Web Vitals réels. |
| `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` | chatbot | fournisseur OpenAI-compatible (Groq / OpenAI / **Azure OpenAI**). Sans clé → mode extractif. |
| `LLM_BASE_URL` / `LLM_API_VERSION` | chatbot | requis pour Azure OpenAI (endpoint + version d'API). |
| `CALENDLY_TOKEN` | calendly | jeton API Calendly v2 (lecture des RDV). |
| `CALENDLY_OWNERS` | calendly | correspondance email→commercial pour l'attribution. |
| `AVAILABILITY_PROVIDER` | calendly (Phase 2) | source de disponibilité agrégée (`none` par défaut). |
| `GOOGLE_CALENDAR_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_JSON` | calendly (Phase 2) | agenda Google agrégé (non activé). |
| `PING_TOKEN` | health/env-check | jeton de sonde de fondation (optionnel). |
| `PORT` | local | port du serveur `tools/api-server.js` (défaut 3000/argument). |

`ANTHROPIC_API_KEY` n'est utilisée que par l'outil de traduction hors-ligne `tools/translate.js`
(non requis en production).

## Documentation détaillée

`docs/` — un fichier par chantier : `deploiement-host`, `migration-vrai-environnement`,
`publish`, `schema/site-content` (contrat de contenu), `chatbot`, `rdv-calendly`, `perf`,
`accessibilite`.

# Rôles & capacités — vérification côté serveur

Ce document décrit comment « qui peut faire quoi » est **appliqué par le serveur** (pas seulement
masqué dans l'interface admin). Chantier **auth**, à partir de v0.36.0.

## Principe

L'interface admin (`admin/js/editor.js`) porte un modèle de capacités (`can()`, `DEFAULT_ROLE_CAPS`)
qui **masque** les vues et boutons selon le rôle. Ce masquage est du confort d'UI : un utilisateur
qui contourne l'interface (appel direct de l'API) n'est pas arrêté par lui.

Depuis v0.36.0, `api/_lib/rbac.js` **reflète fidèlement** ce modèle **côté serveur** et chaque
Function `/api` **exige** la capacité correspondante : si le rôle de l'appelant ne la porte pas,
la réponse est **403** (`{ error, need }`) et **aucune action n'a lieu**.

## Rôles et capacités (miroir du client)

| Rôle | Capacités (défaut) |
|------|--------------------|
| `admin` | **toutes** (`*`) |
| `commercial` | `dashboard.view`, `rdv.view`, `rdv.edit`, `copilot.view` |
| `leadcommercial` | + `rdv.assign`, `rdv.relance`, `rdv.export`, `stats.view`, `affiliation.view` |
| `editor` | `dashboard.view`, `editor.view`, `editor.edit`, `structure.view`, `media.*`, `versions.view`, `chatbot.view`, `chatbot.edit` |

> `editor` **édite** mais ne **publie** pas : `editor.publish` et `versions.restore` ne sont portés
> que par `admin` par défaut (dans le modèle client, ils peuvent être accordés par utilisateur).

## Mapping endpoint → capacité requise

| Endpoint | Capacité |
|----------|----------|
| `POST /api/publish` | `editor.publish` |
| `POST /api/restore` | `versions.restore` |
| `GET /api/history` | `versions.view` |
| `GET /api/perf` | `perf.view` |
| `GET /api/perf-history` | `perf.view` |
| `GET /api/perf-history?run=1` | *(Bearer `CRON_SECRET` OU clé admin — mesure planifiée)* |
| `GET /api/calendly` | `rdv.view` |
| `POST /api/media-upload` · `GET` (diagnostic) | `media.import` |
| `GET /api/collect` (stats) | `stats.view` |
| `POST /api/collect` (page vue) | *(public — collecte anonyme, rate-limité)* |
| `POST /api/chat` | *(public — aucune auth)* |
| `GET /api/config` | *(public — ne renvoie que la clé publique Clerk)* |
| `GET /api/health` (+ `?probe=env`) | *(public — sonde, booléens seuls)* |

## Attribution des rôles (par variables d'environnement)

Aucun rôle n'est codé en dur. L'attribution est une **couture** pilotée par l'ENV (swap = éditer
une variable, pas du code) :

- **`CHASKIS_ROLES`** — JSON `{"<clerk_sub>":"<role>","...":"..."}`. Le `sub` est l'identifiant
  Clerk de l'utilisateur (visible dans le dashboard Clerk → Users). La casse du rôle est normalisée
  (`"Editor"` = `"editor"`). Un `sub` mappé à un rôle **inconnu** (faute de frappe) est
  **verrouillé** (aucune capacité) — **jamais** promu admin.
- **`CHASKIS_DEFAULT_ROLE`** — rôle d'un utilisateur authentifié **non** listé dans `CHASKIS_ROLES` :
  - **rôle valide** → ce rôle ;
  - **valeur invalide** → **verrouillé** (fail-closed) ;
  - **absent** → dépend du verrouillage de l'instance (revue sécurité) :
    - `CLERK_ALLOWED_SUBS` **renseignée** (instance verrouillée à des comptes de confiance) → `admin` ;
    - `CLERK_ALLOWED_SUBS` **vide** (inscription potentiellement ouverte côté Clerk) → **`none`**
      (fail-closed : sinon tout inscrit inconnu deviendrait admin). **En prod : renseigner
      `CLERK_ALLOWED_SUBS` (recommandé) OU `CHASKIS_DEFAULT_ROLE`.**
- **`PUBLISH_SECRET`** (repli Bearer / `?fallback=1` / tests) → toujours **admin** (clé maîtresse).

## Posture de production recommandée (fail-closed)

Par défaut, un utilisateur authentifié **non mappé** obtient `admin` (choix non-cassant, adapté à
l'unique administrateur actuel). Dès qu'il y a **plusieurs** utilisateurs, durcir ainsi :

1. Lister **explicitement** les administrateurs dans `CHASKIS_ROLES` (`{"user_admin":"admin", ...}`).
2. Mettre **`CHASKIS_DEFAULT_ROLE`** à un rôle **restreint** (ex. `commercial`), pour qu'un compte
   autorisé mais oublié dans la carte n'obtienne pas l'accès total.
3. Garder **`CLERK_ALLOWED_SUBS`** renseigné (ou fermer les inscriptions Clerk) pour maîtriser
   **qui** peut s'authentifier.

Ainsi, un compte qu'on aurait oublié de mapper est **restreint par défaut**, pas admin.

## Limite connue (frontière de design)

Le serveur applique les **presets de rôle**. Les **ajustements par utilisateur** (accorder/retirer
une capacité à une personne précise), disponibles dans la matrice de l'admin, vivent aujourd'hui
dans le `localStorage` du navigateur et **ne sont pas visibles du serveur**. Pour les faire
respecter côté serveur, il faudra un magasin d'utilisateurs partagé (base ou claims Clerk) — étape
ultérieure. En attendant : pour donner un droit sensible (publier) à quelqu'un, lui attribuer un
**rôle** qui le porte (aujourd'hui `admin`).

## Cible finale (Azure)

Le schéma est portable : la vérification de session (JWKS, `api/_lib/session.js`) et le modèle de
capacités (`api/_lib/rbac.js`) ne dépendent d'aucun SaaS. Migration Clerk → **Entra ID / Azure AD
B2C** = même vérification par JWKS + mêmes claims ; l'attribution des rôles peut alors s'appuyer sur
les groupes/app-roles Entra au lieu de `CHASKIS_ROLES`.

## Tests

- `tools/rbac.test.js` — modèle de capacités + résolution de rôle (mapping, casse, fail-closed).
- `tools/rbac-endpoints.test.js` — 403 réel par capacité sur `restore`/`history`/`perf`/`calendly`
  (JWT Clerk mocké), **avant** tout appel externe.
- `tools/publish.test.js` — 403 sur `publish` pour un rôle sans `editor.publish`.
- `tools/session.test.js` — vérification JWT + résolution du principal.

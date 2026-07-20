# Contrat `site-content.json` (schema v1)

Fichier de reference du contenu editorial publie depuis l'admin. C'est le **contrat central** entre l'editeur (`admin/`), la Function de publication (`api/publish.js`) et les pages publiques. Il n'appartient a aucun chantier : tout chantier qui ecrit ou lit ce fichier passe par le validateur unique `api/_lib/content-schema.js`.

> Etat actuel : le fichier `site-content.json` EXISTE a la racine et la publication est fonctionnelle de bout en bout (voir `docs/publish.md`). Ce document et le validateur posent le contrat pour que publish/media/chatbot/analytics/perf ne l'inventent pas chacun de leur cote. Le lecteur public `assets/js/content.js` l'applique en fail-silent.

## Convention des Serverless Functions (`/api`)

- **CommonJS** (`module.exports`), **aucune dependance npm**, **aucun build**, **aucun `package.json`** tant qu'aucun SDK n'est requis (les chantiers `auth`/`media` en introduiront un, partage pour tout `/api`).
- Reponse en **API Node brute** (`res.setHeader` / `res.statusCode` / `res.end`) et non les helpers `res.status().json()` de Vercel : identique sur Vercel et sur un serveur Node/Express classique -> **portable** vers vos propres serveurs.
- `fetch` natif de **Node 18+** pour les appels externes (pas de `node-fetch`).
- Chaque Function pose **son propre `Cache-Control`** (rien n'est herite) : `no-store` sur les ecritures et reponses uniques, `s-maxage` sur les lectures cachables.
- Dossier `api/_lib/` : prefixe `_` => **exclu du routage Vercel**, reserve aux librairies partagees (comme ce validateur). Ce n'est pas un endpoint.
- Un secret ne quitte **jamais** le serveur : il vit dans `process.env` cote Function. Cote client on n'expose qu'un booleen (`/api/health?probe=env`) ou de la donnee publique.

> Note : le plan technique mentionnait `export default` (ESM) pour `host` et `module.exports` (CJS) pour `publish`. On tranche pour **CJS partout**, seul choix qui fonctionne sans `package.json` ni `.mjs`, passe `node --check`, se teste via `require()` et reste portable.

## Structure (v1)

```jsonc
{
  "schemaVersion": 1,              // obligatoire, doit valoir 1
  "version": "V12",               // optionnel, libelle de version lisible
  "updatedAt": "2026-07-08T10:00:00.000Z", // optionnel, ISO
  "updatedBy": "Alex Moreira",    // optionnel, auteur de la publication

  "pricing": {                    // miroir de DEFAULT_PRICING (admin/js/editor.js)
    "days": 22,
    "tiers":  [ { "max": 10, "rate": 16, "plan": "Express" }, /* ... */ ],
    "zones":  [ { "key": "geneve", "name": "Geneve", "unit": 14 }, /* ... */ ],
    "flexMonthly": 249, "flexIncluded": 30, "express": 9,
    "promos": [ { "code": "BIENVENUE", "pct": 15 } ]
  },

  "testimonials": [ /* { name, role, quote, photo? } */ ],
  "logos":        [ /* { id, name, src, height, keepColor } */ ],

  "pages": {                      // une entree par page editable
    "accueil":   { "i18n": { "fr": { "hero.overline": "..." }, "en": { /* ... */ } } },
    "mobilite":  { "i18n": { "fr": {}, "en": {} } },
    "recrutement": { "i18n": { "fr": {}, "en": {} } },
    "commander": { "i18n": { "fr": {}, "en": {} } },
    "suivi":     { "i18n": { "fr": {}, "en": {} } },
    "dashboard": { "i18n": { "fr": {}, "en": {} } }
  }
}
```

Les cles i18n (`hero.overline`, `promo.badge`, ...) sont celles portees par les attributs `data-i18n` du markup. On ne les fige pas dans une allowlist (elles sont nombreuses et evoluent), mais **chaque valeur chaine est controlee** contre le XSS et les dataURL.

### Cle `chatbot` (reglages de l'assistant + base de connaissances publiee)

Section optionnelle, allowlistee (cles hors liste = rejet). Elle porte le « quoi » de
l'assistant, applique en ligne par `api/chat.js` apres publication.

```jsonc
"chatbot": {
  "botName": "...", "tone": "...", "length": "...", "defaultLang": "fr",
  "emojiLevel": "...", "instructions": "...",
  "fallback": "...", "uncertain": "...", "address": "...",
  "forbidden": ["sujet interdit", "..."],   // tableaux de chaines
  "allowed":   ["..."],                       // indicatif (non applique en ligne)
  "sources": [ { "title": "...", "tags": ["..."], "text": "..." } ]  // base de connaissances (PUBLIQUE)
}
```

Cles autorisees (`CHATBOT_KEYS`) : `forbidden, allowed, tone, length, fallback, botName,
instructions, address, emojiLevel, defaultLang, uncertain, sources`. Un element de `sources`
n'accepte que `title, tags, text` (`CHATBOT_SOURCE_KEYS`). **Le texte des sources est PUBLIC**
(present dans `site-content.json`) : n'y mettre aucune donnee confidentielle. Meme controle
anti-XSS que le reste du contenu.

## Regles imposees par le validateur (`validateContent`)

| Regle | Comportement |
|-------|--------------|
| `schemaVersion` != 1 | rejet |
| Cle racine hors allowlist | rejet (barriere anti-fuite de donnees personnelles) |
| Page hors `accueil/mobilite/recrutement/commander/suivi/dashboard` | rejet |
| Langue hors `fr/en/de/it` | rejet |
| Cle `pricing` inconnue | rejet |
| Valeur contenant une **balise HTML** (`<script`, `<img`, `<svg`, `<iframe`...) | rejet (XSS stocke) |
| Valeur contenant `javascript:`, `vbscript:` ou `data:text/html` | rejet (XSS / navigation) |
| `data:` URI > 2 Ko | rejet (les medias passent par Vercel Blob, chantier `media`) |
| Cle nommee `__proto__` / `constructor` / `prototype` (a tout niveau) | rejet (pollution de prototype) |
| Nombre `NaN` / `Infinity` | rejet (devient `null` a la serialisation) |
| Document > 300 Ko | rejet |
| Type non serialisable (fonction, undefined imbrique) | rejet |

Les valeurs i18n sont du **texte** : toute balise HTML y est refusee. Un `<` suivi d'un espace ou d'un chiffre (`prix < 2h`, `j'aime <3`) n'est PAS une balise et reste autorise (les navigateurs ne parsent une balise que si un nom suit immediatement `<`).

`validateContent(obj)` renvoie `{ ok, errors }`. **Fail-closed** : au moindre doute, on rejette cote publication. Le rendu cote public, lui, doit **degrader en silence** (si le JSON est absent/illisible, la page garde ses valeurs par defaut, jamais de page blanche).

### Defense en profondeur cote rendu (respectee par `assets/js/content.js`)

La validation n'est PAS l'unique barriere. Le code qui lit `site-content.json` (`content.js`) doit :
- injecter les valeurs via **`textContent`**, jamais via `innerHTML` (le seul cas `innerHTML` legitime, `[data-i18n-html]`, doit rester alimente par du markup interne du dev, pas par une valeur publiee) ;
- construire le DOM en **iterant les elements** porteurs de `data-i18n` (lookup `dict[cle]`), jamais en iterant les cles du dictionnaire publie ;
- si un jour un merge de dictionnaires est fait, utiliser `Object.create(null)` ou ignorer les cles `__proto__`.

### Consequence connue

Les `logos` et `photos` de temoignages sont aujourd'hui des **dataURL** en `localStorage` dans l'editeur. Le validateur les **rejettera** (dataURL > 2 Ko) : c'est voulu — on ne publie jamais d'image en base64.

### Remplacements d'images publiees : `pages.<page>.images` (chantier media, FAIT)

Le chantier **media** est fonctionnel : une image importee est envoyee sur le stockage (Vercel Blob) via `/api/media-upload` et recoit une **URL https** persistante. La publication porte ces remplacements sous :

```
pages.<page>.images = { "<src d'origine dans le HTML>": "<URL https du media>" }
```

Regles du validateur (`content-schema.js`) : la valeur **doit** etre une URL `https://` (jamais un dataURL, jamais `http://`), <= 60 entrees/page, cle <= 300 car., URL <= 800 car. Le lecteur public `assets/js/content.js` remplace, hors editeur, chaque `<img>` dont le `src` d'origine figure dans la table (avec repli `onerror` sur l'original). Voir `docs/media.md`.

## Utilisation

```js
const { validateContent, SCHEMA_VERSION } = require('./_lib/content-schema');
const { ok, errors } = validateContent(payload);
if (!ok) return res.statusCode = 400, res.end(JSON.stringify({ error: 'schema', details: errors }));
```

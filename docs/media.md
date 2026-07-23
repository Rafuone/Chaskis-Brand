# Chantier « Média » — stockage réel des fichiers (passation dev)

Objectif : les images (et à terme vidéos) éditées dans l'admin sont stockées comme de **vrais
fichiers** avec une **URL permanente**, au lieu de vivre en `dataURL` dans le `localStorage` du
navigateur (lourd, non partagé, non publiable). Les images remplacées apparaissent sur le **site
public** après publication.

## État : FONCTIONNEL de bout en bout (branche `feat/foundation-vercel`)

Vérifié en ligne sur la préversion : upload d'un fichier → URL publique servie → remplacement
visible sur le site après publication.

## Architecture (host-agnostique — c'est la contrainte maîtresse)

1. **Couture de stockage** — `api/_lib/storage.js` : interface unique `put / readUrl / list / del`.
   Fournisseur choisi par l'env `STORAGE_PROVIDER` :
   - `blob` (défaut si `BLOB_READ_WRITE_TOKEN` présent) : parle **directement à l'API REST de
     Vercel Blob** (`https://blob.vercel-storage.com`, en-tête `Authorization: Bearer <token>` +
     `x-content-type`). **AUCUN SDK `@vercel/blob`** (ce serait une dépendance npm + un couplage
     Vercel, interdits). Version d'API surchargeable par `BLOB_API_VERSION` (défaut `7`).
   - `azure` : **Azure Blob Storage** (cible finale). **Livré et testé** — `STORAGE_PROVIDER=azure`
     + `AZURE_BLOB_SAS_URL` (URL du conteneur + jeton SAS). Contrat REST `x-ms-blob-type` / `comp=list`.
   - `memory` : en mémoire (tests + local sans token).
   - `off` : désactivé.
   Tout est **fail-soft** : jamais d'exception qui remonte, retour `{ ok:false, error }`.
   **Migration Azure** = poser `STORAGE_PROVIDER=azure` + `AZURE_BLOB_SAS_URL` ; aucun appelant à
   réécrire (l'adaptateur est déjà en place). Détails : `docs/integration-azure.md`.

2. **Upload** — `api/media-upload.js` :
   - `POST` (capacité `media.import`) : reçoit `{ filename, contentType, dataBase64 }`, valide le
     type (WebP/PNG/JPEG/SVG) et la taille (≤ 2 Mo — sous la limite Vercel de 4,5 Mo/requête),
     écrit via `storage.put` (avec suffixe aléatoire), renvoie l'**URL publique** persistante.
     `validateUpload` est pur et testé (assainit le nom, neutralise la traversée `..`).
   - `GET` (capacité `media.import`) : **diagnostic** du stockage (aller-retour réel
     put → lecture URL → del). Ne révèle aucun secret (noms de variables présentes seulement).
     *(Fusionné ici pour tenir sous la limite de 12 fonctions du plan Vercel Hobby.)*

3. **Côté éditeur** (`admin/js/editor.js`) :
   - À l'import, l'aperçu reste **instantané** (dataURL) ; en tâche de fond `uploadMediaToBlobAsync`
     envoie le fichier et `replaceMediaSrc` remplace **partout** le dataURL par l'URL Blob
     (médiathèque, images appliquées, fonds). Repli **non-cassant** : sans clé/connexion ou si
     l'API échoue, on garde le dataURL (`entry.stored = "local"`) — la démo hors-ligne reste intacte.

4. **Publication vers le site public** :
   - Schéma (`api/_lib/content-schema.js`) : `pages.<page>.images = { <src d'origine> : <URL https> }`.
     **Seules les URL `https://` sont acceptées** (jamais un dataURL). Bornes : ≤ 60 entrées/page,
     longueurs clé/valeur limitées.
   - `buildSiteContent()` publie `draft.imgPub[page]` en ne gardant que les valeurs `https://`
     (une image encore en cours d'envoi, donc en dataURL, n'est pas publiée). Revenir au src
     d'origine **retire** l'entrée (le site réaffiche l'image par défaut).
   - **Clé stable = le src d'ORIGINE** de l'image (tel qu'écrit dans le HTML). Il est toujours
     présent car publier ne réécrit QUE `site-content.json`, jamais le HTML.
   - Lecteur public (`assets/js/content.js`) : pour chaque `<img>`, si son `src` d'origine est dans
     la table, il le remplace par l'URL publiée. **Uniquement hors éditeur** (`window.top !==
     window.self`) : dans l'iframe de l'admin, content.js ne touche pas aux images (l'éditeur gère
     son propre aperçu), ce qui garantit que l'éditeur capture toujours le vrai src d'origine — pas
     de course, pas de circularité. content.js pose `data-ck-orig-src` côté public pour information.

## Variable d'environnement

| Variable | Rôle |
|----------|------|
| `BLOB_READ_WRITE_TOKEN` | token du store Vercel Blob (**public**). À copier depuis l'onglet `.env.local` du store (Vercel ne l'ajoute pas seul : auth OIDC par défaut). Sert AUSSI à l'analytics. |
| `STORAGE_PROVIDER` | `blob` (défaut si token) \| `azure` (Azure Blob, livré) \| `memory` \| `off`. |
| `AZURE_BLOB_SAS_URL` | (si `azure`) URL du conteneur Azure Blob + jeton SAS. Voir `docs/integration-azure.md`. |
| `BLOB_API_VERSION` | version d'API REST Blob (défaut `7`). |

## Tests

`tools/media.test.js` (validation upload : types, taille, base64, dataURL, anti-traversée) et
`tools/storage.test.js` (couture : sélection de fournisseur, `cleanKey`, round-trip mémoire, chemin
Blob REST avec `fetch` mocké, override de version). Aucun réseau. Lancer : `node tools/test.js`.

## Reste à faire (mineur, noté pour les devs)

- **Vidéos volumineuses** (> 4,5 Mo) : l'upload serveur est plafonné par Vercel. Utiliser le
  *client upload* (jeton client généré côté serveur) sur l'hôte final, ou Azure Blob directement.
  Aujourd'hui les vidéos < 4,5 Mo passent ; au-delà, l'entrée reste une référence locale.
- **Suppression du fichier Blob** quand on retire un média de la médiathèque (évite les orphelins).
- **Images de fond CSS** (ex. bannière FAQ) : publiées non gérées (seuls les `<img>` le sont).

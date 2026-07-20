# Chantier « Analytics » — collecteur d'audience maison (passation dev)

Objectif : afficher les **vraies statistiques d'audience** (tous les visiteurs) **dans l'admin**,
sans cookie et sans service tiers payant.

## Pourquoi un collecteur maison

L'**API d'Umami est réservée au plan Pro (payant)** : sur le compte gratuit, impossible de lire
les chiffres par programme. Vercel Web Analytics est écarté (couplé à Vercel — meurt à la migration
Azure, données non rapatriables dans l'admin sur le plan gratuit, historique 30 j). On collecte
donc nous-mêmes : **gratuit, host-agnostique, rétention maîtrisée**. Le script Umami reste actif
sur le site (gratuit) mais le code n'en lit plus les chiffres.

## État : FONCTIONNEL et vérifié en ligne

Sur la préversion : `POST /api/collect` compte les visites (bots rejetés), `GET /api/collect`
renvoie l'agrégat (`provider:blob`, pages vues / visiteurs / top pages / provenance).

## Architecture

- **Envoi** — `assets/js/analytics.js` : `navigator.sendBeacon('/api/collect', { p, r, l })` sur
  chaque vraie visite. Fail-silent, non bloquant. **Jamais dans l'iframe de l'éditeur**
  (garde-fou `window.top !== window.self`), donc les aperçus admin ne sont pas comptés.

- **Collecte** — `api/collect.js`, `POST` **public** : filtre les **bots** (regex User-Agent),
  calcule un **visiteur unique anonyme** = `sha256(IP + User-Agent + sel du JOUR)` tronqué à 12 hex
  (non réversible, **rotation quotidienne** = aucun suivi d'un jour à l'autre, RGPD-friendly, même
  principe qu'Umami), puis écrit l'événement.

- **Stockage append-only SANS perte** — via la couture `api/_lib/storage.js` (Vercel Blob → Azure).
  **1 événement = 1 objet Blob**, dont la **CLÉ encode l'événement** en base64url :
  `analytics/ev/<jour>/<base64url(JSON)>.<aléa hex>`. Corps vide. Conséquence : pas de
  lecture-modification-écriture d'un fichier partagé → **aucune course, aucune perte** sous
  concurrence (contrairement à un compteur incrémenté).

- **Agrégation** — `GET /api/collect?days=N` (capacité `stats.view`) : **liste les clés PAR JOUR**,
  du plus récent au plus ancien (`analytics/ev/<jour>/`), bornée à `MAX_LIST_CALLS` appels. Le
  listing par jour borne l'effort à la fenêtre demandée et évite qu'un très gros historique (listé
  dans l'ordre lexicographique = plus ancien d'abord) n'évince les données récentes. Décode chaque
  clé (**aucune lecture de corps** → pas de timeout) et agrège : pages vues, **visiteurs / jour
  (moyenne)** — libellé honnête, car le sel quotidien interdit la déduplication inter-jours —, top
  pages, top provenances, série journalière. La clé d'événement est **bornée en longueur à
  l'écriture** (`eventKey`) pour ne jamais être tronquée par le stockage (sinon perte silencieuse).

- **Anti-abus** — le `POST` est public : rate-limit *best-effort* en mémoire (par instance) +
  bornage strict des champs. Une protection **dure** (flood distribué) relève de la **couche hôte**
  (règle Vercel Firewall / Azure Front Door sur `/api/collect`) — une fonction serverless ne peut
  pas limiter de façon fiable sans magasin partagé. IP dérivée d'un en-tête posé par la plateforme
  (non falsifiable par le client), pas du 1er saut de `x-forwarded-for`.

- **Admin** — `renderStatsServer()` (`admin/js/editor.js`) : panneau « Audience réelle (tous les
  visiteurs) » dans la vue Statistiques. **Repli silencieux** (panneau masqué) si pas connecté /
  stockage inactif → le panneau « cet appareil » (mesure locale `chaskis_analytics_v1`) et les
  données de démonstration restent affichés.

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `BLOB_READ_WRITE_TOKEN` | stockage des événements (même store que les médias). Sans lui → repli `memory` (éphémère), le panneau admin reste masqué. |
| `STORAGE_PROVIDER` | `blob` (défaut si token) \| `memory` \| `off`. |
| `ANALYTICS_SALT` | sel du hachage des visiteurs. Optionnel (repli : `PING_TOKEN` puis constante). Mettre une valeur dédiée en prod. |

## Tests

`tools/collect.test.js` (29 cas, 0 réseau) : round-trip clé↔événement, garde de longueur de clé
(anti-perte), filtre anti-bots, déterminisme + rotation quotidienne du hash visiteur, priorité IP
(anti-spoof), validation `ev.t`, assainissement `path`/`ref`.

## Limites & échelle (honnête)

- **Précision** : pages vues / top pages / provenance = aussi précises qu'Umami (mêmes balises
  navigateur). Visiteurs uniques = même méthode cookieless qu'Umami (mêmes limites inhérentes,
  pas pires). Bots filtrés. **Repart de zéro** (pas d'historique importé depuis Umami).
- **Quotas Vercel Blob (plan gratuit)** : ~10k opérations simples + ~2k opérations avancées (list)
  par mois. 1 visite = 1 écriture ; 1 consultation des stats = quelques `list`. Suffisant pour une
  vitrine à faible trafic ; à surveiller si le trafic grimpe.
- **Timeout** : l'agrégation ne lit aucun corps (list-only, par jour) → sûre sur le timeout 10 s du
  plan Hobby. Bornée à `MAX_LIST_CALLS` appels (au-delà, réponse `truncated: true`).
- **Retention** : pas encore de purge automatique des vieux jours (à ajouter — un cron qui supprime
  `analytics/ev/<jour>` au-delà de N jours). Sur l'hôte final, préférer un vrai magasin analytique.
- **Cible Azure** : Application Insights (natif) ou Azure Table Storage derrière la même couture
  `storage.js` — le point d'entrée `/api/collect` et l'admin ne changent pas.

## Contrainte plateforme

Plan Vercel Hobby = **12 Serverless Functions max**. Pour ajouter `/api/collect`, l'ancienne
`/api/env-check` a été fusionnée dans `/api/health` (`?probe=env`). Sur Azure (pas de limite), on
peut re-séparer si besoin.

# Rendez-vous — intégration Calendly

Chantier **Rendez-vous** : brancher de vrais RDV Calendly dans l'admin, avec **une seule
page de réservation centrale** et une **redistribution faite chez nous** (pas le
round-robin payant de Calendly). Aucune dépendance npm, aucun build.

## Principe (et pourquoi ça reste peu cher)

- Tous les RDV arrivent sur **UN seul calendrier Calendly central**.
- L'admin les lit et les **attribue automatiquement** au commercial disponible le moins
  chargé ; l'admin / lead commercial peut **réattribuer à la main**.
- On n'utilise **pas** le round-robin de Calendly (qui imposerait le plan Teams + un
  siège payant par commercial). Un seul calendrier suffit.

## Coût réel (vérifié)

| Ce que vous voulez | Plan Calendly | Coût |
|---|---|---|
| Réservation seule (widget sur le site) | Free | **0 CHF** |
| Réservation **+ remontée des RDV dans l'admin** | Free (lecture API) | **0 CHF** pour tester |
| Remontée **en temps réel** (webhook) plus tard | Standard, 1 siège | **~10 CHF/mois** |
| Round-robin natif Calendly (déconseillé ici) | Teams, 3 sièges | ~40-48 CHF/mois |

Point clé : **l'API de lecture de Calendly fonctionne sur le plan gratuit** (seuls les
webhooks temps réel exigent un plan payant). On lit donc les RDV par interrogation à
l'ouverture de la vue — suffisant pour éprouver la solution à 0 CHF.

## Pièces

- `api/calendly.js` — endpoint `GET /api/calendly` : lit le compte central (API v2, GET),
  normalise, attribue, renvoie `{ ok, source, count, rdv[] }`. Auth Bearer `PUBLISH_SECRET`.
- `api/_lib/calendly-map.js` — cartographie pure événement Calendly → format RDV de l'admin.
- `api/_lib/assign.js` — attribution pure (commercial dispo le moins chargé).
- `api/_lib/availability.js` — **couture** disponibilité : `none` par défaut (aucun compte),
  `google` en Phase 2 (freebusy), Microsoft 365 en cible Azure — même contrat.
- `tools/calendly.test.js` — 35 tests (`node tools/calendly.test.js`), sans réseau ni clé.

## Activer (compte gratuit, pour tester)

1. Créer un **compte Calendly gratuit** et un type de RDV « Réserver un appel ».
2. Récupérer le **lien de réservation public** (pour l'embed sur le site — Phase 2 UI).
3. Créer un **jeton d'accès personnel** : Calendly → Integrations → API & webhooks →
   *Personal access tokens*. Le coller dans les variables d'environnement de l'hôte :
   ```
   CALENDLY_TOKEN  = <le jeton>          (serveur uniquement, JAMAIS dans le client)
   CALENDLY_OWNERS = Sarah,Marc,Jean-Christophe   (optionnel ; défaut = ces 3 noms)
   ```
   `PUBLISH_SECRET` est déjà en place (partagé avec publish/history/restore).
4. L'admin lit alors les vrais RDV à l'ouverture de la vue Rendez-vous. Sans
   `CALENDLY_TOKEN`, l'endpoint renvoie 501 et l'admin **retombe sur les RDV de démo**.

## Attribution automatique par agenda (Phase 2)

Aujourd'hui, faute de fournisseur de disponibilité, l'attribution se fait par simple
équilibrage (personne n'est exclu). Pour n'attribuer qu'à un commercial **réellement
libre**, brancher un fournisseur dans `api/_lib/availability.js` :

- **Google Agenda** (gratuit) : API `freeBusy`, identifiants `GOOGLE_*` côté serveur,
  chaque commercial → son `calendarId`. `AVAILABILITY_PROVIDER=google`.
- **Alternative sans compte Google** : un petit module d'absences saisi dans l'admin.
- **Cible Azure** : Microsoft 365 / Outlook via le même `getBusyChecker()`.

Rien d'autre à changer : l'attribution consomme déjà le résultat de la couture.

## Tester en local

```
node tools/calendly.test.js                       # 35 tests, sans réseau
PUBLISH_SECRET=x node tools/api-server.js 3199     # sert le site + /api hors Vercel
curl -H 'Authorization: Bearer x' localhost:3199/api/calendly   # 501 tant que CALENDLY_TOKEN absent
```

## Migration Azure

- `api/calendly.js` + libs = Node brut CommonJS `(req,res)`, sans dépendance : tournent
  tels quels sur Azure App Service. Voir `docs/migration-vrai-environnement.md`.
- Calendly est le **service de test**, remplaçable (Microsoft Bookings) : les appels sont
  isolés dans l'endpoint, le secret dans une variable d'env → swap contenu.
- La disponibilité (Google aujourd'hui → Microsoft 365 demain) est derrière une couture.

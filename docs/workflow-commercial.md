# Workflow commercial — état & reprise (note de passation)

> **Point de reprise au 2026-07-21.** Branche `feat/foundation-vercel`, HEAD `6ffd255`, admin **v0.50.0**,
> **15 suites de tests vertes**, **12/12 fonctions Vercel Hobby**. `main` (prod) et `demo` intacts.
> Contexte de départ (constat, décision produit, options CRM) : voir la section « Historique » en bas.

## Ce qui est FAIT

- **Capture des demandes** : le formulaire public « Commander » n'envoyait rien ; il POST désormais
  vers `api/crm.js` (append-only Blob, fail-silent). Panneau **« Demandes reçues »** au tableau de bord
  (cliquable → fiche client).
- **Page Clients** (nouvelle vue, menu + capacités `clients.view`/`clients.edit`) : registre dérivé et
  dédupliqué des RDV + demandes (clé = entreprise normalisée > domaine e-mail pro > e-mail > contact),
  **partagé** (sources déjà communes). Tableau paginé calqué sur la page Rendez-vous.
- **Fiche client** (modale) : coordonnées cliquables, ses rendez-vous, ses **comptes-rendus centralisés**,
  ses demandes, + section **« Suivi commercial » partagée** (statut / prochaine étape / offre) enregistrée
  via `POST /api/crm?kind=client` → `clients/<clé>` (Blob).
- **Recâblage** : RDV → « Voir la fiche client » ; fiche client → « Piloter avec le copilote » ;
  **Copilote retiré du menu** (se lance uniquement depuis un client/RDV).
- **Jeu de démonstration stable** (`cliDemoSources`) : 8 entreprises + 2 demandes, statuts variés,
  comptes-rendus, offres — affiché tant qu'aucune vraie donnée n'existe (découplé de Calendly).
- **Refonte du tableau (v0.50.0)** : recherche à gauche ; bouton **Filtres** → modale (commercial /
  secteur / offre) ; **choix du nombre par page** (10/25/50/100) ; colonne **Commercial** (avatars
  empilés) ; **tags de statut colorés éditables** (composant `.statusel`/`RDV_STC`+`CLI_STC`, sans « Auto ») ;
  colonne Actions **alignée** (`#view-clients .tbl td{vertical-align:middle}` + `<div class="cli-actions">`
  dans un `<td>` normal) ; actions carrées `.iconbtn`+info-bulle (copilote / relance e-mail / fiche) ;
  nombre de comptes-rendus = pastille cliquable.

## Ce qui RESTE (priorisé — reprise directe)

1. **Sélection multiple + barre d'actions groupées** dans le tableau Clients (relancer / changer le
   statut en lot). Utile à 200 clients. → **Réutiliser** la page RDV : `rdvSel` (Set), `renderRdvBulk`,
   `#rdvSelAll`, cellule `<td class="chk"><input class="rsel">`, `<div class="bulk-bar">` ; CSS `.chk`/`.rsel`/`.bulk-bar`.
2. **Fiche client** : afficher **qui a fait quel RDV** (le commercial de chaque rendez-vous dans
   `openClientCard`) et rendre les RDV listés cliquables.
3. **Copilote depuis un client sans RDV** : pré-remplir **date/heure du jour** (`prepareCopilotForClient`,
   via `copState.rdvLabel` ; pas de champ date dans `copState` aujourd'hui).
4. **Relance / note** (aujourd'hui bas de la page RDV) exposées dans la fiche client.
5. **Lot 4 — KPIs réels + étiquetage démo** : calculer conversion/présence/à-venir depuis les vrais RDV
   quand chargés (⚠️ la **conversion** n'est pas calculable sans les données d'abonnement du back-office
   → à **étiqueter « exemple »**, ne pas inventer) ; nettoyer/étiqueter « exemple » les stats de démo
   (dashboard, tableau équipe RDV, statistiques, chatbot, affiliation) ; corriger l'incohérence
   Jean-Christophe (absent de `TEAM_STATS`).
6. **(transverse)** Articulation avec la **vraie page Clients du back-office** (clients ACTIFS abonnés
   Flex/Express/Dédié) : ma page = pipeline amont (prospects/leads/RDV). Prévu : statut « Client actif » +
   champ offre déjà en place ; brancher la synchro quand le CRM cible sera défini.

## Repères techniques (fichiers/fonctions)

- **Vue Clients** (`admin/js/editor.js`) : `renderClients` + boucle des lignes, `cliBuildIndex`,
  `cliDemoSources`, `cliStatus`/`cliStat`/`CLI_STC`, `openClientCard`, `openCliFilters`,
  `saveClientStatusInline`, `saveClientSuivi`, `cliRelance`, `prepareCopilotForClient`,
  `CLI_PER_PAGE`/`cliPage`/`cliFilterAdv`. CSS : bloc `.cli-*` + `.lead-*` dans `admin/css/editor.css`.
  Markup : `#view-clients` dans `admin/editor.html`.
- **Endpoint** `api/crm.js` : `POST` public (lead, anti-bot/rate-limit) · `GET` (leads, `clients.view`) ·
  `POST /api/crm?kind=client` (`clients.edit`, écrit `clients/<clé>`) · `GET /api/crm?kind=clients`.
- Le coloriage des tags passe par `stcOf(v)` (lit `RDV_STC` puis `CLI_STC`) dans `enhanceSelect`.

## Contraintes (rappel)

- Host-agnostique (CommonJS, 0 dépendance, couture `api/_lib/storage.js`), **démo préservée**, éditeur fragile.
- **12 Serverless Functions max** (on est à 12 : consolider avant d'en ajouter).
- Rituel de release (ADMIN_BUILD / RELEASE_LOG / PROGRESS / TECH_UPDATED) + `node tools/test.js` (15 suites)
  avant de conclure ; `git fetch` + `pull --rebase` avant push ; **ne pas toucher `main`/`demo`**.
- ⚠️ Ne **jamais** tester le portail d'auth avec un `POST /api/publish` valide (ça écrit le vrai contenu).
- **Décision % :** un chantier « Espace commercial » dans le Suivi technique reste à créer en une fois
  (fera baisser le global ~87 % par dilution du périmètre = pas une régression, à expliquer au proprio).

## Historique (contexte de départ)

Constat initial : Client / Copilote / Rendez-vous cloisonnés, aucune entité « client », comptes-rendus
peu découvrables, trop de données factices. Décisions validées par le propriétaire : hub Clients **dans
l'admin** (mini-CRM léger), **partagé** entre commerciaux, **réel dès que possible + démo étiquetée**.
Option CRM back-office (pousser clients/leads vers un CRM cible) reste ouverte pour plus tard (combinable
avec le hub local qui se synchronisera).

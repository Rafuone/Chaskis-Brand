# Workflow commercial — état & reprise (note de passation)

> **Point de reprise au 2026-07-21.** Branche `feat/foundation-vercel`, HEAD `b8e082d`, admin **v0.56.0**,
> **15 suites de tests vertes**, **11/12 fonctions Vercel Hobby**. `main` (prod) et `demo` intacts.
>
> ⚠️ **LEÇON (2026-07-21)** : sur les filtres, j'ai d'abord changé le MÉCANISME (barre/panneau/règles,
> page de propositions) alors qu'Alexandre voulait garder la FENÊTRE et changer son CONTENU. Corrigé
> en v0.56.0 : même fenêtre `openCliFilters`, contenu scalable (listes recherchables + plage du/au).
> Ne pas reconfondre « contenant » et « contenu » d'un composant qu'il a déjà validé.
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
  dans un `<td>` normal) ; actions `.iconbtn`+info-bulle (copilote / relance e-mail / fiche) ;
  nombre de comptes-rendus = pastille cliquable.
- **Sélection multiple + actions groupées (v0.51.0)** : réutilise LITTÉRALEMENT la page RDV — `cliSel`
  (Set par `c.key`), cellule `<td class="chk"><input class="rsel">`, `#cliSelAll` (état indéterminé),
  `#cliBulk`/`.bulk-bar`, `renderCliBulk`/`cliSyncSelUI`. Barre : **relance groupée** (`cliBulkRelance` =
  un `mailto` avec tous les destinataires en **Cci**) + **changement de statut en lot** (`cliBulkStatus`,
  même chemin partagé que `saveClientStatusInline`). Sélection conservée (chaînable) ; vidée sur
  recherche/filtre. Cases à cocher **bleu foncé** (`--ink`), boutons d'action **carrés** (32×32).
- **En-tête revu + pagination (v0.51.0)** : onglets de filtre **soulignés SOUS** la barre de recherche
  (`.cli-filters` en tabs) ; bouton **Filtres à la même hauteur** que l'input (40px) ; **pagination
  toujours visible** dès qu'il y a des clients (plage + contrôles, même sur une seule page).
- **Fiche client = fil de suivi (v0.51.0)** : chaque RDV affiche **qui** (avatar+nom via `commercialChip`)
  et **quand**, **cliquable** → déplie son **compte-rendu attribué** (`cli-rdv-item`/`cli-rdv-detail`) ;
  chaque compte-rendu de la section est **attribué** (commercial + date + sujet, `cr.rdv.who`).
- **Filtres — contenu de la fenêtre revu & scalable (v0.56.0)** : MÊME fenêtre `openCliFilters` ; dedans,
  Commercial + Secteur = listes à cocher RECHERCHABLES (`.cli-checklist`/`.cli-msearch` — tiennent à
  10+/15+), « Dernière activité » = plage du/au (`input type=date`) + raccourcis non bloquants, Statut
  (multi) + Offre (multi) en chips, raccourcis métier (à relancer / RDV à venir / sans commercial / avec
  compte-rendu). `cliFilterAdv` = arrays multi + dateFrom/dateTo ; `cliFilterCount`/`cliFilterEmpty`.
- **Compte-rendu après coup (v0.55.0)** : rédiger/modifier le compte-rendu d'un RDV depuis sa fiche
  (`rdvFicheInner`/`openRdvDrawer` : `rdvCrBlock` lecture+Modifier / bouton Rédiger, `rdvCrEditor`,
  `saveRdvCr` → `r.compteRendu`/`compteRenduAt`, persiste via saveRdvOverride/saveRdv, remonte dans la
  fiche client). Cas d'usage : RDV sur place ou sans copilote.
- **Refonte design fiche + filtres (v0.54.0, audit UI/UX demandé par Alexandre)** : hiérarchie typo
  (labels `.cli-fld>span` muted uppercase petits vs valeurs `--ink`), **dividers** entre sections
  (`.cli-d-contact` bordé), espacement régulier ; **dropdown statut** (`enhanceSelect`) aligné sur les
  badges = menu `.dd-status-menu` + variables `--so-bg/--so-c` par option → hover ET sélection teintés
  comme le badge, option « déduit » via `data-stc-*` ; **relance** = SELECT de modèle à droite de l'objet
  (`.cli-rel-row`, `#cliRelTpl`) au lieu des 4 puces ; **filtres métier** = vues rapides « À relancer »
  (`cliNeedsFollowUp`) / « RDV à venir » + tranche de dates (`cliPeriodCutoff`/`CLI_PERIOD_OPTS`), en
  plus de commercial/secteur/offre (`cliFilterAdv` étendu). Vérifié navigateur, 15 suites vertes.
- **Fiche client = vrai OUTIL + relance intégrée + filtres à puces (v0.52.0)** : bandeau **résumé** en tête
  (`.cli-kpis` : nb RDV / dernier RDV / dernière relance / prochaine étape) + avatar entreprise ; **relance
  par e-mail DANS la fiche** (`.cli-relance` : `cliRelanceTemplates` = 4 modèles éditables contextualisés,
  objet+corps modifiables, « Ouvrir dans ma messagerie » + « Marquer comme relancé » → `lastRelanceAt`
  horodaté, visible au résumé) ; l'icône relance du tableau ouvre la fiche sur ce panneau (`cliRelance` →
  `openClientCard(key,{relance:true})`). **Modale Filtres** = **puces** `.cli-chip` (avatars commerciaux,
  pastilles secteur/offre) au lieu des dropdowns. Backend : `clientEnrichFromBody` accepte
  `lastRelanceAt`/`lastRelanceKind` ; **tous les POST partiels passent par `cliEnrichPayload()`** (payload
  COMPLET) pour ne pas écraser les champs non modifiés (l'objet `clients/<clé>` est réécrit en entier).

## Ce qui RESTE (priorisé — reprise directe)

> ✅ **Faits en v0.51.0** : (1) sélection multiple + barre d'actions groupées (relance groupée en Cci +
> statut en lot) ; (2) fiche client = fil de suivi (qui/quand par RDV, RDV cliquable dépliant son
> compte-rendu attribué). + retours design Alexandre (onglets sous la recherche, bouton Filtres même
> hauteur, cases bleu foncé, boutons carrés, pagination visible).

> ✅ **Lot 4 fait en v0.53.0** : tableau d'équipe RDV **réel** quand Calendly connecté (`teamAgg`/`renderTeam`
> live-aware) sinon démo ; **Jean-Christophe** ajouté à `TEAM_STATS` ; **conversion « exemple » partout**
> (jamais calculable sans le back-office) ; tag `.ex-tag` sur les chiffres démo (dashboard/stats/chatbot/
> équipe) + note `#rdvTeamNote`. Affiliation NON taguée (vrais décomptes, pas des métriques fabriquées).

1. **Copilote depuis un client sans RDV** : pré-remplir **date/heure du jour** (`prepareCopilotForClient`,
   via `copState.rdvLabel` ; pas de champ date dans `copState` aujourd'hui). ⚠️ Vérifier : d'après le
   journal des versions, une partie a déjà été livrée en v0.49.0 — contrôler avant de recoder.
2. **Relance / note** (aujourd'hui bas de la page RDV) exposées dans la fiche client (idem : vérifier v0.49.0).
3. **(transverse)** Articulation avec la **vraie page Clients du back-office** (clients ACTIFS abonnés
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
- **Sélection multiple** : `cliSel` (Set de `c.key`), `cliCurrentShown` (liste affichée pour « tout
  sélectionner »), `renderCliBulk`/`cliSyncSelUI`, `cliBulkStatus`, `cliBulkRelance`, `#cliSelAll`/`#cliBulk`.
  CSS partagé avec RDV : `td.chk`/`.rsel`/`.bulk-bar` (case cochée = `accent-color:var(--ink)`).
- **Fiche = suivi** : dans `openClientCard`, RDV triés desc en `.cli-rdv-item` cliquables (`[data-rdvtoggle]`
  déplie `.cli-rdv-detail`) ; comptes-rendus attribués via `cr.rdv.who` + `commercialChip`.

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

# Workflow commercial — état, trous et direction (note de passation)

Cette note cadre la **cohérence du parcours commercial** dans l'admin. Elle est le point de
départ du prochain chantier (demandé par le propriétaire le 2026-07-21).

## Les « notions commerciales » de l'admin aujourd'hui

- **Rendez-vous** (`view-rdv`) : liste des RDV (démo + synchro Calendly réelle), fiche/tiroir par
  RDV avec statut, note, réattribution du commercial, relance.
- **Copilote RDV** (`view-copilot`) : outil pendant l'entretien (découverte guidée, simulateur
  d'offre, compte-rendu).
- **Statistiques**, **Performance**, **Affiliation** : vues avec beaucoup de données de
  démonstration.
- Il n'existe **AUCUNE vue « Clients »**. La notion de « client » n'a pas d'entité propre : un
  client n'existe qu'implicitement, dupliqué dans chaque ligne de `rdvData`.

## Ce qui est DÉJÀ relié (fait en v0.44.x)

- **Copilote ↔ Rendez-vous** : depuis la fiche d'un RDV, « Préparer / piloter avec le copilote »
  ouvre le copilote pré-rempli et le **lie** au RDV. À « Terminer », le **compte-rendu est
  rattaché au RDV** (`r.compteRendu`, visible dans la fiche) et proposé « honoré ».
- **Comptes-rendus** : consultables (a) dans la **fiche du RDV** concerné, (b) dans le panneau
  **« Comptes-rendus récents »** de la vue Copilote (relire + re-télécharger), (c) en `.txt`
  téléchargé. Persistés en `localStorage` (override RDV `RDV_OVR_KEY` pour le live, `chaskis_rdv_v1`
  pour la démo ; historique copilote `chaskis_copilot_hist`).

## Les TROUS identifiés par le propriétaire (à traiter)

1. **Cloisonnement** : Client / Copilote / Rendez-vous restent « enfermés les uns dans les
   autres ». Il n'y a pas de fil conducteur **par client** (un client = plusieurs RDV, plusieurs
   comptes-rendus, un statut dans le temps, une prochaine étape).
2. **Découvrabilité des comptes-rendus** : même rattachés, ils ne sont pas assez centraux — « je
   ne sais pas où retrouver le compte-rendu d'un rendez-vous ».
3. **Trop de données factices qui ne remontent nulle part** : `TEAM_STATS`, KPIs RDV, graphes,
   stats chatbot, affiliation = démonstration pure, aucune agrégation depuis le réel.
4. **Pas de « registre clients »** : les commerciaux devraient retrouver **l'ensemble des clients**
   quelque part (dans cet admin), OU les données devraient partir vers le **back-office / CRM**.

## Décision produit à trancher AVANT de coder

**Où vit la relation client ?**

- **Option A — Hub « Clients » dans cet admin (mini-CRM léger).** Une nouvelle vue **Clients** :
  liste dédupliquée des clients/prospects (dérivée des RDV + comptes-rendus + leads), chaque fiche
  agrégeant historique des RDV, comptes-rendus, statut, prochaine étape. Les vues RDV/Copilote y
  renvoient (fil conducteur par client). Reste host-agnostique (stockage via la couture existante).
- **Option B — Pousser vers le vrai back-office / CRM.** L'admin reste un outil de préparation ;
  clients + comptes-rendus + leads sont envoyés à un endpoint (`/api/lead`, `/api/crm-…`) qui
  alimente le CRM Chaskis. Plus léger côté admin, mais dépend d'un back-office cible à définir.
- (Les deux peuvent se combiner : hub local qui se synchronise plus tard vers le CRM.)

## Pistes connexes déjà identifiées (audit produit)

- **Capturer les leads du formulaire « Commander »** (`POST /api/lead`, même modèle append-only que
  `api/collect.js`) → un panneau « Demandes reçues » convertible en RDV : la brique de conversion
  la plus rentable, et un point d'entrée naturel du registre clients.
- **KPIs commerciaux calculés depuis le réel** (au lieu des constantes) quand les vrais RDV sont
  chargés : présence, conversion, à-venir (voir `teamAgg`).

## Contraintes à respecter (rappel)

- Host-agnostique (CommonJS, 0 dépendance, couture stockage), démo à préserver, éditeur fragile.
- Plan Vercel Hobby = **12 Serverless Functions max** (actuellement à 12 : consolider avant d'en
  ajouter). Rituel de release + `node tools/test.js` avant de conclure. Ne pas toucher `main`/`demo`.

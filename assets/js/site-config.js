/* Chaskis, configuration du site, éditable SANS build.
 *
 * Un seul endroit pour les réglages « par déploiement » qui ne sont ni du contenu
 * (site-content.json, éditable dans l'admin) ni des secrets (variables d'environnement
 * serveur). Chargé avant les scripts de page.
 */
window.CHASKIS_CONFIG = window.CHASKIS_CONFIG || {};

/* URL publique de réservation Calendly (page d'accueil, section « Réserver un appel »).
 * - Renseignée  -> le vrai widget Calendly remplace le calendrier de démonstration.
 * - Vide ("")   -> le calendrier de démonstration intégré reste affiché (démo cliente).
 * C'est un lien PUBLIC (pas un secret) ; le jeton d'API Calendly, lui, reste côté serveur. */
window.CHASKIS_CONFIG.calendlyUrl = "https://calendly.com/alexandre-moreira-gamma-project/30min";

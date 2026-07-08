// api/_lib/content-schema.js — Contrat central de site-content.json.
//
// Point transverse #1 du plan technique : « le schema de site-content.json est le
// contrat central, et il n'appartient a aucun chantier ». Ce module est ce contrat.
// publish, media, chatbot, analytics et perf ecrivent/lisent tous ce fichier : ils
// DOIVENT valider via ce module unique, sinon chacun invente sa forme et le site
// public casse en silence le jour ou une cle est renommee.
//
// Le prefixe `_` du dossier exclut api/_lib/ du routage Vercel : ce n'est PAS un
// endpoint, juste une librairie require()-able par les Functions (ex. api/publish.js
// fera `const { validateContent } = require('./_lib/content-schema')`).
//
// CommonJS, aucune dependance, testable directement via `node -e "require(...)"`.
'use strict';

// Version du schema. Un site-content.json d'une autre version est refuse : c'est le
// garde-fou qui evite qu'un site public lise une structure qu'il ne comprend pas.
const SCHEMA_VERSION = 1;

// Allowlist STRICTE des cles racine. Toute autre cle => rejet (barriere anti-fuite :
// aucune donnee personnelle de RDV/lead ne doit se retrouver dans le JSON public).
const TOP_LEVEL_KEYS = ['schemaVersion', 'version', 'updatedAt', 'updatedBy', 'pricing', 'testimonials', 'logos', 'pages'];

// Pages editables : miroir EXACT de EDIT_PAGES dans admin/js/editor.js.
const PAGE_KEYS = ['accueil', 'mobilite', 'recrutement', 'commander', 'suivi', 'dashboard'];

// Langues i18n reconnues (le site gere fr/en aujourd'hui, de/it prevus).
const LANG_KEYS = ['fr', 'en', 'de', 'it'];

// Cles autorisees dans pricing : miroir de DEFAULT_PRICING (admin/js/editor.js).
const PRICING_KEYS = ['days', 'tiers', 'zones', 'flexMonthly', 'flexIncluded', 'express', 'promos'];

// Bornes de securite.
const MAX_TOTAL_BYTES = 300 * 1024; // 300 Ko : du contenu texte reste petit ; au-dela = anomalie.
const MAX_DATAURL_LEN = 2048;       // rejette les dataURL media (les images passent par la mediatheque/Blob, pas par le JSON versionne).

// Un champ de contenu est du TEXTE : aucune balise HTML n'y a sa place. On rejette
// donc toute balise (pas seulement <script), car une denylist de deux motifs laisse
// passer <img onerror=>, <svg onload=>, <iframe>, etc. Les navigateurs ne parsent une
// balise que si un nom/'!'/'/'suit immediatement '<' : "prix < 2h" ou "j'aime <3" ne
// sont donc PAS des balises et restent autorises. Choix fail-closed (l'editeur humain
// corrige a la publication), double par une defense cote rendu (textContent, jamais innerHTML).
const RE_SCRIPT = /<script/i;
const RE_TAG = /<[a-z!/]/i;
const RE_JS_PROTO = /javascript:/i;
const RE_VBSCRIPT = /vbscript:/i;
const RE_DATA_HTML = /data:\s*text\/html/i;
const RE_DATAURL = /^\s*data:/i;

// Cles interdites partout : vecteur de pollution de prototype si un futur consommateur
// fait un merge recursif du contenu publie.
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Refuse une chaine dangereuse : XSS stocke (balise HTML, javascript:/vbscript:,
// data:text/html) ou dataURL media volumineuse.
function stringError(path, s) {
  if (RE_SCRIPT.test(s)) return path + ' : balise <script interdite';
  if (RE_TAG.test(s)) return path + ' : balise HTML interdite dans un champ de contenu (le texte est rendu tel quel)';
  if (RE_JS_PROTO.test(s)) return path + ' : URI javascript: interdit';
  if (RE_VBSCRIPT.test(s)) return path + ' : URI vbscript: interdit';
  if (RE_DATA_HTML.test(s)) return path + ' : URI data:text/html interdit';
  if (RE_DATAURL.test(s) && s.length > MAX_DATAURL_LEN) {
    return path + ' : dataURL trop volumineuse (' + s.length + ' > ' + MAX_DATAURL_LEN + ' car.) ; passer par la mediatheque (Vercel Blob), pas par le JSON versionne';
  }
  return null;
}

// Parcours recursif : toute valeur chaine est controlee, les nombres doivent etre finis
// (NaN/Infinity deviennent null a la serialisation JSON), les cles dangereuses et les
// types non serialisables sont refuses.
function scanValue(path, v, errors) {
  if (typeof v === 'string') { const e = stringError(path, v); if (e) errors.push(e); return; }
  if (typeof v === 'number') { if (!Number.isFinite(v)) errors.push(path + ' : nombre non fini (NaN/Infinity) interdit'); return; }
  if (typeof v === 'boolean' || v === null) return;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) scanValue(path + '[' + i + ']', v[i], errors); return; }
  if (isPlainObject(v)) {
    for (const k of Object.keys(v)) {
      if (DANGEROUS_KEYS.includes(k)) { errors.push(path + '.' + k + ' : cle interdite (pollution de prototype)'); continue; }
      scanValue(path + '.' + k, v[k], errors);
    }
    return;
  }
  errors.push(path + ' : type non serialisable en JSON (' + typeof v + ')');
}

// Valide un document site-content.json. Retourne { ok:boolean, errors:string[] }.
// N'accepte JAMAIS un document douteux : en cas de doute on rejette (fail-closed),
// c'est cote publication, pas cote rendu (le rendu, lui, doit degrader en silence).
function validateContent(input) {
  const errors = [];
  if (!isPlainObject(input)) return { ok: false, errors: ['racine : objet JSON attendu'] };

  // 1. Taille brute.
  let raw = '';
  try { raw = JSON.stringify(input); }
  catch (e) { return { ok: false, errors: ['racine : JSON non serialisable (' + e.message + ')'] }; }
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes > MAX_TOTAL_BYTES) errors.push('document : trop volumineux (' + bytes + ' > ' + MAX_TOTAL_BYTES + ' octets)');

  // 2. schemaVersion.
  if (input.schemaVersion !== SCHEMA_VERSION) {
    errors.push('schemaVersion : attendu ' + SCHEMA_VERSION + ', recu ' + JSON.stringify(input.schemaVersion));
  }

  // 3. Allowlist racine.
  for (const k of Object.keys(input)) {
    if (!TOP_LEVEL_KEYS.includes(k)) errors.push('cle racine inconnue : ' + k);
  }

  // 4. Champs meta optionnels, mais types si presents.
  for (const k of ['version', 'updatedAt', 'updatedBy']) {
    if (k in input && typeof input[k] !== 'string') errors.push(k + ' : chaine attendue');
  }

  // 5. pricing : objet a cles connues.
  if ('pricing' in input) {
    if (!isPlainObject(input.pricing)) errors.push('pricing : objet attendu');
    else for (const k of Object.keys(input.pricing)) {
      if (!PRICING_KEYS.includes(k)) errors.push('pricing.' + k + ' : cle inconnue');
    }
  }

  // 6. testimonials / logos : tableaux.
  if ('testimonials' in input && !Array.isArray(input.testimonials)) errors.push('testimonials : tableau attendu');
  if ('logos' in input && !Array.isArray(input.logos)) errors.push('logos : tableau attendu');

  // 7. pages : allowlist des pages, structure { i18n:{ <lang>:{} } }, langues connues.
  if ('pages' in input) {
    if (!isPlainObject(input.pages)) errors.push('pages : objet attendu');
    else for (const pk of Object.keys(input.pages)) {
      if (!PAGE_KEYS.includes(pk)) { errors.push('page inconnue : ' + pk); continue; }
      const pg = input.pages[pk];
      if (!isPlainObject(pg)) { errors.push('pages.' + pk + ' : objet attendu'); continue; }
      for (const k of Object.keys(pg)) {
        if (k !== 'i18n') errors.push('pages.' + pk + '.' + k + ' : seule la cle i18n est autorisee');
      }
      if ('i18n' in pg) {
        if (!isPlainObject(pg.i18n)) errors.push('pages.' + pk + '.i18n : objet attendu');
        else for (const lang of Object.keys(pg.i18n)) {
          if (!LANG_KEYS.includes(lang)) errors.push('pages.' + pk + '.i18n.' + lang + ' : langue non supportee');
          else if (!isPlainObject(pg.i18n[lang])) errors.push('pages.' + pk + '.i18n.' + lang + ' : dictionnaire (objet) attendu');
        }
      }
    }
  }

  // 8. Balayage securite de TOUTES les valeurs chaine (XSS stocke, dataURL media).
  scanValue('root', input, errors);

  return { ok: errors.length === 0, errors };
}

module.exports = {
  SCHEMA_VERSION,
  TOP_LEVEL_KEYS,
  PAGE_KEYS,
  LANG_KEYS,
  PRICING_KEYS,
  MAX_TOTAL_BYTES,
  MAX_DATAURL_LEN,
  validateContent,
};

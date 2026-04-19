#!/usr/bin/env node
/**
 * translate.js : Auto-traducteur FR vers EN pour Chaskis
 *
 * Usage : node translate.js
 *
 * Ce script :
 * 1. Lit index.html et extrait T.fr (toutes les clés FR)
 * 2. Compare avec T.en pour trouver les clés manquantes
 * 3. Appelle l'API Claude pour traduire en lot (FR→EN)
 * 4. Injecte les nouvelles traductions dans T.en dans index.html
 *
 * Prérequis : ANTHROPIC_API_KEY dans l'environnement ou fichier .env
 *   npm install @anthropic-ai/sdk dotenv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

// Support .env optionnel
try {
  const { config } = await import('dotenv');
  config();
} catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, 'index.html');
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY manquante. Ajoutez-la dans votre environnement ou un fichier .env');
  process.exit(1);
}

const client = new Anthropic({ apiKey: API_KEY });

// ── 1. Lire le fichier HTML ──────────────────────────────────────────────────
const html = fs.readFileSync(HTML_FILE, 'utf8');

// ── 2. Extraire T.fr et T.en via regex ──────────────────────────────────────
function extractDict(source, langLabel) {
  // Trouve le bloc "fr: { ... }" ou "en: { ... }" dans const T = { ... }
  const blockRe = new RegExp(String.raw`\b${langLabel}\s*:\s*\{`, 'g');
  const match = blockRe.exec(source);
  if (!match) return {};

  // Parcours les accolades pour trouver la fermeture
  let depth = 1;
  let i = match.index + match[0].length;
  let content = '';
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
    content += ch;
    i++;
  }

  // Évalue le bloc comme objet JS (simplifié : eval dans un contexte propre)
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`return ({${content}})`)();
  } catch (e) {
    console.error('Erreur parsing dict:', e.message);
    return {};
  }
}

const dictFr = extractDict(html, 'fr');
const dictEn = extractDict(html, 'en');

const missingKeys = Object.keys(dictFr).filter(k => !(k in dictEn));

if (missingKeys.length === 0) {
  console.log('✅  Toutes les clés FR ont déjà une traduction EN. Rien à faire.');
  process.exit(0);
}

console.log(`🔍  ${missingKeys.length} clé(s) à traduire : ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '…' : ''}`);

// ── 3. Appel Claude pour traduire ────────────────────────────────────────────
const toTranslate = missingKeys.map(k => ({ key: k, fr: dictFr[k] }));

const prompt = `Tu es un traducteur professionnel FR→EN pour un service B2B de livraison suisse (Chaskis).
Traduis chaque valeur du français vers l'anglais. Garde EXACTEMENT le même HTML interne (balises <strong>, <br>, <span class="ac">, <svg>, etc.). Traduis uniquement le texte visible.
Réponds UNIQUEMENT avec un objet JSON valide de la forme { "clé": "traduction_en", ... }, sans aucun texte autour.

Valeurs à traduire :
${JSON.stringify(Object.fromEntries(toTranslate.map(({ key, fr }) => [key, fr])), null, 2)}`;

let newEnEntries = {};
try {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = msg.content[0].text.trim();
  // Extrait le JSON même s'il y a du texte autour
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pas de JSON dans la réponse');
  newEnEntries = JSON.parse(jsonMatch[0]);
  console.log(`✅  ${Object.keys(newEnEntries).length} traduction(s) reçue(s)`);
} catch (e) {
  console.error('❌  Erreur API Claude:', e.message);
  process.exit(1);
}

// ── 4. Injecter dans T.en ─────────────────────────────────────────────────
// Trouve la fin du bloc en: { ... } et insère les nouvelles entrées avant }
const enBlockRe = /\ben\s*:\s*\{/g;
const enMatch = enBlockRe.exec(html);
if (!enMatch) {
  console.error('❌  Bloc T.en introuvable dans index.html');
  process.exit(1);
}

// Trouver la position de fermeture du bloc en
let depth = 1;
let pos = enMatch.index + enMatch[0].length;
while (pos < html.length && depth > 0) {
  const ch = html[pos];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) break; }
  pos++;
}

// Construire les nouvelles lignes à insérer
const newLines = Object.entries(newEnEntries)
  .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join('\n');

const updatedHtml =
  html.slice(0, pos) +
  '\n' + newLines + '\n  ' +
  html.slice(pos);

fs.writeFileSync(HTML_FILE, updatedHtml, 'utf8');
console.log(`💾  index.html mis à jour avec ${Object.keys(newEnEntries).length} nouvelle(s) entrée(s) EN`);
console.log('🚀  Rechargez la page pour voir les traductions.');

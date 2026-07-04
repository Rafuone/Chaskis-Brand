#!/usr/bin/env bash
# Garde-fou de release : bloque un `git commit` si admin/editor.html a changé
# sans que ADMIN_BUILD.version ait été monté (= checklist de release non faite, cf CLAUDE.md).
# Compare le contenu du fichier à HEAD, donc marche aussi avec `git add && git commit`.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || true
input=$(cat)

# Ne concerne que les commits
printf '%s' "$input" | grep -q 'git commit' || exit 0

# Rien à vérifier si admin/editor.html n'a pas changé par rapport à HEAD
git diff --quiet HEAD -- admin/editor.html 2>/dev/null && exit 0

cur=$(grep -oE 'ADMIN_BUILD = \{ version: "[^"]*"' admin/editor.html 2>/dev/null)
prev=$(git show HEAD:admin/editor.html 2>/dev/null | grep -oE 'ADMIN_BUILD = \{ version: "[^"]*"')

if [ -n "$cur" ] && [ "$cur" = "$prev" ]; then
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Checklist de release non faite : admin/editor.html a change mais la version n a pas ete montee. Fais d abord (voir CLAUDE.md) : bump ADMIN_BUILD.version, ajoute une entree en tete de RELEASE_LOG (cur:true, retire cur de la precedente), mets TECH_UPDATED a la date du jour, mets a jour PROGRESS. Puis recommence le commit."}}'
fi
exit 0

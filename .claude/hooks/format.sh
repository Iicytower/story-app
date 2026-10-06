#!/usr/bin/env bash
# PostToolUse (Edit|Write): formatuje edytowany plik. Cicho pomija, dopóki narzędzia nie są zainstalowane.
file=$(jq -r '.tool_input.file_path // empty')
cd "$CLAUDE_PROJECT_DIR" || exit 0
[[ -z "$file" || ! -f "$file" ]] && exit 0
case "$file" in
  */node_modules/*|*/.next/*) exit 0 ;;
esac
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    [[ -x node_modules/.bin/eslint ]] && node_modules/.bin/eslint --fix "$file" >/dev/null 2>&1
    [[ -x node_modules/.bin/prettier ]] && node_modules/.bin/prettier --write "$file" >/dev/null 2>&1 ;;
  *.json|*.css|*.md|*.yml|*.yaml)
    [[ -x node_modules/.bin/prettier ]] && node_modules/.bin/prettier --write "$file" >/dev/null 2>&1 ;;
esac
exit 0

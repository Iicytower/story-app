#!/usr/bin/env bash
# Stop: runs tsc; errors go back to Claude (exit 2). Skips when the project is not initialized yet.
input=$(cat)
[[ $(jq -r '.stop_hook_active' <<<"$input") == "true" ]] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[[ -f tsconfig.json && -x node_modules/.bin/tsc ]] || exit 0
# Typecheck only when there are uncommitted changes in TS files.
git status --porcelain -- '*.ts' '*.tsx' | grep -q . || exit 0
if ! out=$(node_modules/.bin/tsc --noEmit -p . 2>&1); then
  echo "Typecheck failed:" >&2
  echo "$out" | head -50 >&2
  exit 2
fi
exit 0

#!/usr/bin/env bash
# Stop: uruchamia tsc; błędy wracają do Claude (exit 2). Pomija, gdy projekt nie jest jeszcze zainicjalizowany.
input=$(cat)
[[ $(jq -r '.stop_hook_active' <<<"$input") == "true" ]] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[[ -f tsconfig.json && -x node_modules/.bin/tsc ]] || exit 0
# Typecheck tylko gdy są niezacommitowane zmiany w plikach TS.
git status --porcelain -- '*.ts' '*.tsx' | grep -q . || exit 0
if ! out=$(node_modules/.bin/tsc --noEmit -p . 2>&1); then
  echo "Typecheck failed:" >&2
  echo "$out" | head -50 >&2
  exit 2
fi
exit 0

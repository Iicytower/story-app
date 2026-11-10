#!/usr/bin/env bash
# Stop: during /autorun the orchestrator may only stop once every subtask is done ([x]) or its file has a
# "## Blokada" or "## Pominięty" section. The skill removes the lock at the very end.
input=$(cat)
lock="$CLAUDE_PROJECT_DIR/.claude/autorun.lock"
[[ -f $lock ]] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
umbrella=$(head -1 "$lock")
left=()
while IFS= read -r row; do
  [[ $row =~ \[x\]\ \|$ ]] && continue
  file=$(grep -oE '\(([^)]*\.md)\)' <<<"$row" | head -1 | tr -d '()')
  [[ -n $file ]] && grep -qE '^## (Blokada|Pominięty)' "docs/tasks/$file" 2>/dev/null && continue
  left+=("$(cut -d'|' -f2 <<<"$row" | tr -d ' ')")
done < <(grep -E "\(subtask $umbrella\)" docs/tasks/README.md)
((${#left[@]} == 0)) && exit 0
# A second stop with no new commit since the last block means the run is stuck: let it stop.
head=$(git rev-parse HEAD)
seen="$CLAUDE_PROJECT_DIR/.claude/autorun.last-stop"
if [[ $(jq -r '.stop_hook_active' <<<"$input") == "true" && -f $seen && $(cat "$seen") == "$head" ]]; then
  exit 0
fi
echo "$head" >"$seen"
echo "Autorun of task $umbrella is not finished: tasks ${left[*]} remain. Continue the /autorun loop (or mark a task as skipped/blocked through docs-keeper)." >&2
exit 2

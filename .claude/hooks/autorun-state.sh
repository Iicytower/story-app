#!/usr/bin/env bash
# SessionStart (compact, resume): during /autorun, restore the run's state from the repo after compaction.
lock="$CLAUDE_PROJECT_DIR/.claude/autorun.lock"
[[ -f $lock ]] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
umbrella=$(head -1 "$lock")
echo "Autorun of task $umbrella is in progress (.claude/autorun.lock). Continue with the /autorun skill loop."
echo "Current branch: $(git branch --show-current)"
echo "Uncommitted changes: $(git status --porcelain | wc -l) files"
echo "Recent commits:"; git log --oneline -8
echo "Task rows:"; grep -E "^\| $umbrella |\(subtask $umbrella\)" docs/tasks/README.md
exit 0

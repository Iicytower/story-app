#!/usr/bin/env bash
# PreToolUse (Bash, AskUserQuestion): during /autorun (.claude/autorun.lock) nobody is there to answer
# a question or approve a package install, so both are refused with a hint instead of stalling the run.
lock="$CLAUDE_PROJECT_DIR/.claude/autorun.lock"
[[ -f $lock ]] || exit 0
input=$(cat)
tool=$(jq -r '.tool_name' <<<"$input")
if [[ $tool == AskUserQuestion ]]; then
  echo "Autorun: the user is away. Decide yourself (simplest option consistent with docs/decisions.md) and report it as a decision to log." >&2
  exit 2
fi
command=$(jq -r '.tool_input.command // ""' <<<"$input")
if grep -qE '(^|[;&|[:space:]])(npm|pnpm|yarn)[[:space:]]+(install|i|add|uninstall|remove|rm)([[:space:]]|$)' <<<"$command"; then
  echo "Autorun: installing or removing packages is not allowed (approved packages are already installed, D80). Use existing dependencies." >&2
  exit 2
fi
exit 0

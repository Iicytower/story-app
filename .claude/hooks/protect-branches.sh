#!/usr/bin/env bash
# PreToolUse (Bash): Claude never merges into or pushes to staging and main (D45).
# Each part of a chained command is checked against the branch it would run on.

command=$(jq -r '.tool_input.command // ""')
branch=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null)
protected='^(staging|main|master)$'
git_prefix='^[[:space:]]*git([[:space:]]+-[cC][[:space:]]+[^[:space:]]+)*[[:space:]]+'

block() {
  echo "Blocked by D45: $1. The user does this." >&2
  exit 2
}

while IFS= read -r part; do
  if [[ $part =~ ${git_prefix}(checkout|switch)[[:space:]]+([^[:space:]-][^[:space:]]*) ]]; then
    branch=${BASH_REMATCH[3]}
  elif [[ $part =~ ${git_prefix}merge([[:space:]]|$) ]]; then
    [[ $part =~ --(abort|quit) ]] && continue
    [[ $branch =~ $protected ]] && block "merge into $branch"
  elif [[ $part =~ ${git_prefix}push([[:space:]]|$) ]]; then
    [[ $part =~ [[:space:]]--(all|mirror) ]] && block "push of all branches"
    [[ $part =~ ([[:space:]:+]|refs/heads/)(staging|main|master)([[:space:]]|$) ]] && block "push to ${BASH_REMATCH[2]}"
    # Only "git push" or "git push <remote>" follows the current branch.
    args=$(sed -E "s/${git_prefix}push//" <<<"$part" | tr -s ' ')
    [[ $args =~ ^[[:space:]]*(-[^[:space:]]+[[:space:]]*)*([^[:space:]-]+)?[[:space:]]*$ && $branch =~ $protected ]] && block "push to $branch"
  elif [[ $part =~ ^[[:space:]]*gh[[:space:]]+pr[[:space:]]+merge ]]; then
    block "merging a pull request"
  fi
done < <(sed -E 's/&&|\|\||;|\|/\n/g' <<<"$command")

exit 0

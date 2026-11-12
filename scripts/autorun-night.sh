#!/usr/bin/env bash
# Runs /autorun <task> headless and resumes the same conversation after a usage limit or an API error,
# until the skill removes .claude/autorun.lock (run finished) or the run stalls.
#
# Usage: scripts/autorun-night.sh <umbrella task> [--resume]
# Env: AUTORUN_WAIT (seconds between attempts, default 1200), AUTORUN_MAX_ATTEMPTS (default 40),
#      AUTORUN_MAX_STALLS (normal exits in a row without a new commit, default 3), AUTORUN_MODEL.
set -uo pipefail

task=${1:?usage: scripts/autorun-night.sh <umbrella task> [--resume]}
cd "$(git rev-parse --show-toplevel)"

wait_s=${AUTORUN_WAIT:-1200}
max_attempts=${AUTORUN_MAX_ATTEMPTS:-40}
max_stalls=${AUTORUN_MAX_STALLS:-3}
lock=.claude/autorun.lock
session_file=.claude/autorun.session
log_dir=.claude/autorun-logs
mkdir -p "$log_dir"

# Nobody answers prompts at night: "auto" decides like the interactive session, anything that would
# still ask is denied instead of hanging (the agent sees the denial and works around it).
common=(-p --permission-mode auto --permission-prompts none --output-format text)
[[ -n ${AUTORUN_MODEL:-} ]] && common+=(--model "$AUTORUN_MODEL")
rules="Unattended night run: the user is asleep. Never ask questions; decide by the autorun skill rules and log the decision. A denied tool call is final: do not retry it, use another allowed way or record it as a blocker."

if [[ ${2:-} == --resume && -f $session_file ]]; then
  session=$(cat "$session_file")
else
  session=$(cat /proc/sys/kernel/random/uuid)
  echo "$session" >"$session_file"
fi

last_commit() { git for-each-ref --sort=-committerdate --count=1 --format='%(objectname)' refs/heads; }

attempt=0
stalls=0
while ((attempt < max_attempts)); do
  attempt=$((attempt + 1))
  log="$log_dir/$(date +%Y%m%d-%H%M%S)-$attempt.log"
  before=$(last_commit)
  echo "[$(date '+%F %T')] attempt $attempt/$max_attempts, session $session, log $log"

  if ((attempt == 1)) && [[ ${2:-} != --resume ]]; then
    claude "${common[@]}" --session-id "$session" --append-system-prompt "$rules" "/autorun $task" >"$log" 2>&1
  else
    claude "${common[@]}" --resume "$session" \
      "Continue /autorun $task. Restore the state from the repo (branch, git log, task statuses, Blokada sections) and go on with the next unfinished subtask." >"$log" 2>&1
  fi
  code=$?
  tail -n 5 "$log"

  limited=0
  ((code != 0)) && limited=1
  grep -qiE 'usage limit|rate limit|limit reached|resets? (at|in)|overloaded|529|5-hour limit' <(tail -n 20 "$log") && limited=1

  # The skill creates the lock at the start and removes it after the final report.
  if ((limited == 0)) && [[ ! -f $lock ]]; then
    echo "[$(date '+%F %T')] lock removed, run finished."
    exit 0
  fi

  if ((limited == 0)); then
    if [[ $(last_commit) == "$before" ]]; then stalls=$((stalls + 1)); else stalls=0; fi
    if ((stalls >= max_stalls)); then
      echo "[$(date '+%F %T')] $stalls normal exits without a new commit, stopping. Check $log."
      exit 1
    fi
    sleep 60
  else
    echo "[$(date '+%F %T')] limit or API error (exit $code), waiting ${wait_s}s."
    sleep "$wait_s"
  fi
done

echo "[$(date '+%F %T')] $max_attempts attempts used, stopping."
exit 1

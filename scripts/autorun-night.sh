#!/usr/bin/env bash
# Runs /autorun <task> headless and resumes the same conversation after a usage limit or an API error,
# until the skill removes .claude/autorun.lock (run finished) or the run stalls.
#
# Usage: scripts/autorun-night.sh <umbrella task> [--resume]
# Env: AUTORUN_MODEL (main session model, default sonnet; agents keep their own models),
#      AUTORUN_MAX_ATTEMPTS (attempts that did not end on a usage limit, default 40),
#      AUTORUN_MAX_ERRORS (API errors in a row, default 12), AUTORUN_ERROR_WAIT (seconds, default 300),
#      AUTORUN_WAIT (seconds after a limit whose reset time is unknown, default 1200),
#      AUTORUN_MAX_STALLS (normal exits in a row without a new commit, default 3).
set -uo pipefail

task=${1:?usage: scripts/autorun-night.sh <umbrella task> [--resume]}
cd "$(git rev-parse --show-toplevel)"

wait_s=${AUTORUN_WAIT:-1200}
error_wait=${AUTORUN_ERROR_WAIT:-300}
max_attempts=${AUTORUN_MAX_ATTEMPTS:-40}
max_errors=${AUTORUN_MAX_ERRORS:-12}
max_stalls=${AUTORUN_MAX_STALLS:-3}
model=${AUTORUN_MODEL:-sonnet}
lock=.claude/autorun.lock
session_file=.claude/autorun.session
log_dir=.claude/autorun-logs
mkdir -p "$log_dir"

# Nobody answers prompts at night: "auto" decides like the interactive session, anything that would
# still ask is denied instead of hanging (the agent sees the denial and works around it).
# stream-json writes every message as it happens, so the log shows progress during an attempt.
common=(-p --permission-mode auto --permission-prompts none --output-format stream-json --verbose --model "$model")
rules="Unattended night run: the user is asleep. Never ask questions; decide by the autorun skill rules and log the decision. A denied tool call is final: do not retry it, use another allowed way or record it as a blocker."

if [[ ${2:-} == --resume && -f $session_file ]]; then
  session=$(cat "$session_file")
else
  session=$(cat /proc/sys/kernel/random/uuid)
  echo "$session" >"$session_file"
fi

say() { echo "[$(date '+%F %T')] $*"; }
last_commit() { git for-each-ref --sort=-committerdate --count=1 --format='%(objectname)' refs/heads; }

# Epoch of the limit reset: the CLI's rate_limit_event, else the "resets 7:30pm" text, else empty.
reset_epoch() {
  local log=$1 epoch text
  epoch=$(grep -o '"status":"rejected"[^}]*"resetsAt":[0-9]*' "$log" | grep -o '[0-9]*$' | tail -n 1)
  if [[ -z $epoch ]]; then
    text=$(grep -oiE 'resets [0-9]{1,2}(:[0-9]{2})? ?(am|pm)' "$log" | tail -n 1 | cut -d' ' -f2-)
    [[ -n $text ]] && epoch=$(date -d "$text" +%s 2>/dev/null)
    # "resets 9:30am" said at 23:00 means tomorrow.
    [[ -n $epoch ]] && ((epoch < $(date +%s) - 60)) && epoch=$((epoch + 86400))
  fi
  echo "$epoch"
}

attempt=0
errors=0
stalls=0
run=0
first=1
while ((attempt < max_attempts)); do
  run=$((run + 1))
  log="$log_dir/$(date +%Y%m%d-%H%M%S)-$run.log"
  before=$(last_commit)
  say "attempt $((attempt + 1))/$max_attempts, session $session, model $model, log $log"

  if ((first)) && [[ ${2:-} != --resume ]]; then
    claude "${common[@]}" --session-id "$session" --append-system-prompt "$rules" "/autorun $task" >"$log" 2>&1
  else
    claude "${common[@]}" --resume "$session" \
      "Continue /autorun $task. Restore the state from the repo (branch, git log, task statuses, Blokada sections) and go on with the next unfinished subtask." >"$log" 2>&1
  fi
  code=$?
  first=0
  tail -n 1 "$log" | grep -o '"result":"[^"]*' | cut -c11-300

  # Only the last lines (final result, CLI errors): earlier output may quote such phrases.
  end=$(tail -n 3 "$log")
  if ((code != 0)) && grep -qiE "hit your .*limit|usage limit|limit reached|\"status\":\"rejected\"" <<<"$end"; then
    # Limits do not use up attempts: the run continues after every reset.
    errors=0
    reset=$(reset_epoch "$log")
    if [[ -n $reset ]]; then
      pause=$((reset - $(date +%s) + 60))
      ((pause < 60)) && pause=60
      say "usage limit, sleeping until $(date -d "@$((reset + 60))" '+%F %T')."
    else
      pause=$wait_s
      say "usage limit, reset time unknown, waiting ${wait_s}s."
    fi
    sleep "$pause"
    continue
  fi

  attempt=$((attempt + 1))
  # 403 from Cloudflare, overloaded API, network: short wait, these pass quickly.
  if ((code != 0)); then
    errors=$((errors + 1))
    if ((errors >= max_errors)); then
      say "$errors API errors in a row, stopping. Check $log."
      exit 1
    fi
    say "API error (exit $code, $errors in a row), waiting ${error_wait}s."
    sleep "$error_wait"
    continue
  fi
  errors=0

  # The skill creates the lock at the start and removes it after the final report.
  if [[ ! -f $lock ]]; then
    say "lock removed, run finished."
    exit 0
  fi

  if [[ $(last_commit) == "$before" ]]; then stalls=$((stalls + 1)); else stalls=0; fi
  if ((stalls >= max_stalls)); then
    say "$stalls normal exits without a new commit, stopping. Check $log."
    exit 1
  fi
  sleep 60
done

say "$max_attempts attempts used, stopping."
exit 1

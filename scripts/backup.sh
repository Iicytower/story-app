#!/usr/bin/env bash
# Backup of the MongoDB database via mongodump in a mongo:8 container (bash + Docker only).
# URI: MONGODB_URI from .env.prod next to the repo root (ENV_FILE overrides), otherwise asked for.
# Result: $BACKUP_DIR/<UTC timestamp>/ with <db>.archive.gz and dump/<db>/; the newest 5 are kept.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env.prod}"
# Cron does not always set USER.
BACKUP_DIR="${BACKUP_DIR:-/home/${USER:-$(id -un)}/backups/story_app}"
IMAGE="mongo:8"
KEEP=5
TIMESTAMP_PATTERN='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$'

fail() {
  echo "Error: $*" >&2
  exit 1
}

read_uri_from_env_file() {
  [[ -f "$ENV_FILE" ]] || return 0
  # Not sourced: Atlas URIs contain '&' and the file may hold other values.
  local line
  line="$(grep -E '^[[:space:]]*(export[[:space:]]+)?MONGODB_URI=' "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*MONGODB_URI=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

uri="$(read_uri_from_env_file)"
if [[ -z "$uri" ]]; then
  echo "MONGODB_URI not found in $ENV_FILE."
  read -rs -p "MongoDB URI: " uri || true
  echo
fi
[[ -n "$uri" ]] || fail "no MongoDB URI given."

# mongodb[+srv]://[user:pass@]host[,host]/db[?options]
without_scheme="${uri#*://}"
[[ "$without_scheme" != "$uri" ]] || fail "URI must start with mongodb:// or mongodb+srv://."
credentials=""
if [[ "${without_scheme%%/*}" == *@* ]]; then
  credentials="${without_scheme%%@*}"
fi
password=""
if [[ "$credentials" == *:* ]]; then
  password="${credentials#*:}"
fi
path_part="${without_scheme#*/}"
[[ "$path_part" != "$without_scheme" ]] || path_part=""
db="${path_part%%\?*}"
[[ -n "$db" ]] || fail "URI must include the database name (.../<db>?...)."

mask() {
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ -n "$password" ]]; then
      line="${line//"$password"/***}"
    fi
    printf '%s\n' "$line"
  done
}

command -v docker >/dev/null 2>&1 || fail "docker not found. Install Docker to run backups."
if ! docker_error="$(docker info 2>&1 >/dev/null)"; then
  if [[ "$docker_error" == *"permission denied"* ]]; then
    fail "no permission to use Docker. Add your user to the docker group."
  fi
  fail "Docker is not running."
fi

mkdir -p "$BACKUP_DIR"

config=""
target=""
done_ok=0
cleanup() {
  [[ -n "$config" ]] && rm -f "$config"
  if [[ "$done_ok" -eq 0 && -n "$target" ]]; then
    rm -rf -- "$target"
  fi
}
trap cleanup EXIT

# Config file instead of --uri, so the password is not visible in the process list.
config="$(mktemp)"
chmod 600 "$config"
printf "uri: '%s'\n" "${uri//\'/\'\'}" >"$config"

# UTC, so names sort chronologically also across DST changes.
while :; do
  timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  if mkdir "$BACKUP_DIR/$timestamp" 2>/dev/null; then
    target="$BACKUP_DIR/$timestamp"
    break
  fi
  [[ -d "$BACKUP_DIR/$timestamp" ]] || fail "cannot create $BACKUP_DIR/$timestamp."
  sleep 1
done

echo "Backing up database $db to $target"
if ! docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$config:/config.yaml:ro" -v "$target:/backup" \
  "$IMAGE" bash -c '
    set -e
    mongodump --config=/config.yaml --db="$1" --gzip --archive="/backup/$1.archive.gz"
    mongodump --config=/config.yaml --db="$1" --gzip --out=/backup/dump
  ' _ "$db" 2>&1 | mask; then
  fail "mongodump failed, backup removed."
fi

done_ok=1
echo "Backup saved to $target"

mapfile -t backups < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | grep -E "$TIMESTAMP_PATTERN" | sort)
excess=$((${#backups[@]} - KEEP))
for ((i = 0; i < excess; i++)); do
  rm -rf -- "${BACKUP_DIR:?}/${backups[i]}"
  echo "Removed old backup ${backups[i]}"
done

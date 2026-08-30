#!/usr/bin/env bash
# Runner control: safe-restart (skip if busy) and watchdog (restart on stale queue + idle)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# Serialize: bail out if another instance is running
exec 9>/tmp/runner-ctl.lock
flock -n 9 || { echo "$(date -Iseconds) another instance running, exit"; exit 0; }

[ -f .env ] && set -a && . ./.env && set +a

: "${ACCESS_TOKEN:?ACCESS_TOKEN required}"

# Auto-discover any env var ending in _REPO_URL (matches compose.yml convention).
REPOS=()
while IFS= read -r var; do
  REPOS+=("${!var}")
done < <(compgen -v | grep '_REPO_URL$' || true)
[ "${#REPOS[@]}" -gt 0 ] || { echo "no *_REPO_URL vars found in .env"; exit 1; }

STALE_SECS="${STALE_SECS:-120}"

api() {
  curl -fsSL \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

repo_slug() { echo "$1" | sed -E 's#https?://github.com/##; s#\.git$##'; }

any_busy() {
  local total=0
  for url in "${REPOS[@]}"; do
    local slug; slug=$(repo_slug "$url")
    local n
    # Fail-safe: on API/jq failure assume busy so we don't kill a running job.
    n=$(api "https://api.github.com/repos/$slug/actions/runners" \
        | jq '[.runners[] | select(.busy == true)] | length') || return 0
    total=$((total + n))
  done
  [ "$total" -gt 0 ]
}

has_stale_queue() {
  local now; now=$(date +%s)
  for url in "${REPOS[@]}"; do
    local slug; slug=$(repo_slug "$url")
    local oldest
    oldest=$(api "https://api.github.com/repos/$slug/actions/runs?status=queued&per_page=30" \
            | jq -r '[.workflow_runs[].created_at] | min // empty') || continue
    [ -z "$oldest" ] && continue
    local created
    created=$(date -d "$oldest" +%s 2>/dev/null) || continue
    if [ $((now - created)) -gt "$STALE_SECS" ]; then
      echo "$(date -Iseconds) stale queued run in $slug since $oldest"
      return 0
    fi
  done
  return 1
}

case "${1:-}" in
  safe-restart)
    if any_busy; then
      echo "$(date -Iseconds) safe-restart: runner busy, skip"
      exit 0
    fi
    echo "$(date -Iseconds) safe-restart: cycling"
    make cycle
    ;;
  watchdog)
    if ! has_stale_queue; then
      echo "$(date -Iseconds) watchdog: no stale queue"
      exit 0
    fi
    if any_busy; then
      echo "$(date -Iseconds) watchdog: stale queue but runner busy, skip"
      exit 0
    fi
    echo "$(date -Iseconds) watchdog: stale queue + idle, cycling"
    make cycle
    ;;
  *)
    echo "usage: $0 {safe-restart|watchdog}" >&2
    exit 1
    ;;
esac

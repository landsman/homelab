#!/usr/bin/env sh
#
# Rolls this folder out to runner boxes, one after another, and proves each took it.
#
#     ./deploy.sh jesse.pollos walter.pollos   from a checkout: copy, restart when idle, check the wrapper
#     ./deploy.sh restart-when-idle            on a box (deploy runs it there): wait for no job, then recreate
#
# Per box: copy the files git tracks in this folder, never the box's own config, .env, data or caches; recreate the runner
# container once no job container runs, as a restart mid-job fails that job for nothing to do with its code. Then
# the wrapper inside the container is compared with this checkout's: rsync replaces the file, and a container still
# holding the old one would report "up" while running the old code. A box that fails does not stop the others; the
# run fails at the end and names it.
#
# No default host: there is more than one runner box, and deploying to the wrong one is silent.
set -eu

here=$(cd "$(dirname "$0")" && pwd)

restart_when_idle() {
  waited=0
  while :; do
    jobs=$(docker ps --filter name=WORKFLOW -q | wc -l | tr -d ' ')
    [ "$jobs" = 0 ] && break
    if [ "$waited" -ge "${IDLE_TIMEOUT:-1800}" ]; then
      echo "still $jobs job(s) running after ${waited}s; nothing restarted" >&2
      return 1
    fi
    echo "waiting for $jobs job(s) to finish…"
    sleep "${IDLE_POLL:-10}"
    waited=$((waited + ${IDLE_POLL:-10}))
  done
  # Recreated, not restarted: a new container mounts the files rsync just wrote, and picks up compose.yml too.
  docker compose up -d --force-recreate runner
}

deploy() {
  host=$1
  # The files git tracks here, and nothing else: runner/config.yml (its token), .env, data/ and cache/ are the box's
  # own and are never in that list, whatever this checkout happens to hold.
  git -C "$here" ls-files -z . | rsync -a --from0 --files-from=- "$here/" "$host":forgejo-runner/ || return 1
  ssh "$host" 'cd forgejo-runner && ./deploy.sh restart-when-idle' </dev/null || return 1
  want=$(cksum <"$here/runner/git")
  got=$(ssh "$host" "docker exec forgejo-runner sh -c 'cksum < /usr/local/bin/git'" </dev/null) || return 1
  if [ "$got" != "$want" ]; then
    echo "$host runs another git wrapper than this checkout ($got, not $want)" >&2
    return 1
  fi
}

case "${1:-}" in
restart-when-idle)
  restart_when_idle
  exit
  ;;
"" | -h | --help)
  echo "usage: $0 <host>... | restart-when-idle" >&2
  exit 2
  ;;
esac

failed=''
for host in "$@"; do
  echo "== $host"
  if deploy "$host"; then echo "ok   $host"; else echo "FAIL $host"; failed="$failed $host"; fi
done
[ -z "$failed" ] || { echo "not deployed:$failed" >&2; exit 1; }

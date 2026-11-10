#!/bin/sh
#
# Frees the runner box's disk after CI: once the jobs are done, if less than MIN_FREE % (40) of the disk Docker writes
# to is free, prunes what Docker no longer uses. Old first (stopped containers, images and build cache unused for a
# day), then the rest only if that was not enough. The job caches (Gradle, mise) are directories, not Docker data,
# and are left alone. Runs as the `cleanup` service in compose.yml.
#
#     ./cleanup.sh loop          the service: after every job, once no job container runs, run `once`
#     ./cleanup.sh once          check now, prune if needed (on a box: make cleanup)
#     ./cleanup.sh needs <pct>   exit 0 when <pct> % free is below MIN_FREE: the decision, for the test
set -eu

MIN_FREE=${MIN_FREE:-40}
DISK=${DISK:-/var/lib/docker}
INTERVAL=${INTERVAL:-30}

# 100 minus df's capacity: df rounds the used share up, so this never reports more room than there is.
free_percent() {
  df -P "$DISK" | awk 'NR == 2 { sub("%", "", $5); print 100 - $5 }'
}

needs() {
  [ "$1" -lt "$MIN_FREE" ]
}

# A docker that fails is not an idle box: nothing is pruned then.
jobs_running() {
  jobs=$(docker ps --filter name=WORKFLOW -q) || return 0
  [ -n "$jobs" ]
}

once() {
  if jobs_running; then
    echo "a job is running; nothing pruned"
    return 0
  fi
  free=$(free_percent)
  if ! needs "$free"; then
    echo "$free% free; nothing to do"
    return 0
  fi
  echo "$free% free, under $MIN_FREE%: pruning what Docker has not used for a day"
  docker container prune -f --filter until=1h
  docker image prune -af --filter until=24h
  docker builder prune -af --filter until=24h
  free=$(free_percent)
  if needs "$free"; then
    echo "$free% free, still under $MIN_FREE%: pruning every image and build cache no container uses"
    docker image prune -af
    docker builder prune -af
  fi
  echo "$(free_percent)% free"
}

# Acts on the change from busy to idle, so a box that stays under the line (data that is not Docker's) is pruned once
# per job rather than every INTERVAL; and once at start, for a box that filled up while this was down.
loop() {
  once || true
  busy=no
  while :; do
    if jobs_running; then
      busy=yes
    elif [ "$busy" = yes ]; then
      busy=no
      once || true
    fi
    sleep "$INTERVAL"
  done
}

case "${1:-}" in
  loop) loop ;;
  once) once ;;
  needs) needs "$2" ;;
  *) sed -n '3,11p' "$0" >&2; exit 2 ;;
esac

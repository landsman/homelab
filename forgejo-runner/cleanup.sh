#!/bin/sh
#
# Frees the runner box's disk after CI. Once the jobs are done, if less than MIN_FREE % (40) of the disk Docker writes
# to is free, it removes stopped containers, build cache no build has used for a day, and images without a tag. Only
# under CRITICAL_FREE % (10), when the next job may not even check out, does it also remove every image and all build
# cache no container uses: that costs the next jobs their cache and a fresh pull, so it is the emergency, not the rule.
# Volumes and the job caches (Gradle, mise; directories, not Docker data) are left alone. Runs as the `cleanup` service
# in compose.yml.
#
#     ./cleanup.sh loop          the service: after every job, once no job container runs, run `once`
#     ./cleanup.sh once          check now, prune if needed (on a box: make cleanup)
#     ./cleanup.sh needs <pct>   exit 0 when <pct> % free is below MIN_FREE: the decision, for the test
set -eu

MIN_FREE=${MIN_FREE:-40}
CRITICAL_FREE=${CRITICAL_FREE:-10}
DISK=${DISK:-/var/lib/docker}
INTERVAL=${INTERVAL:-10}

# 100 minus df's capacity: df rounds the used share up, so this never reports more room than there is.
free_percent() {
  df -P "$DISK" | awk 'NR == 2 { sub("%", "", $5); print 100 - $5 }'
}

needs() {
  [ "$1" -lt "$MIN_FREE" ]
}

# Job containers only. A `self-hosted` job runs inside the runner container and is not seen; a build it runs through
# the socket keeps the cache records it holds, as BuildKit does not prune those, but loses the rest. README: "Disk".
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
  echo "$free% free, under $MIN_FREE%: stopped containers, build cache unused for a day, untagged images"
  docker container prune -f --filter until=1h
  # `until` is last use for build cache, but image creation for images, so images go by tag, not by age.
  docker builder prune -af --filter until=24h
  docker image prune -f
  free=$(free_percent)
  if [ "$free" -lt "$CRITICAL_FREE" ]; then
    echo "$free% free, under $CRITICAL_FREE%: every image and all build cache no container uses"
    docker image prune -af
    docker builder prune -af
  fi
  echo "$(free_percent)% free"
}

# Acts on the change from busy to idle, so a box that stays under the line (data that is not Docker's) is pruned once
# per job rather than every INTERVAL; and once at start, for a box that filled up while this was down. A job shorter
# than INTERVAL can finish between two looks and leave no pass behind; the next job that is seen does it.
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
  *) sed -n '3,13p' "$0" >&2; exit 2 ;;
esac

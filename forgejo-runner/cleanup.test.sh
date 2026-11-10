#!/usr/bin/env bash
# Tests what cleanup.sh would get wrong silently: pruning while a job runs (its images and build cache go mid-build),
# pruning a box that has room, reading df's columns wrong so it never acts, wiping every image and all cache on a box
# that is merely under the line (each job then starts cold), or not wiping them when the disk is nearly full. docker and df are stubs on PATH that record their calls; nothing reaches Docker.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/cleanup.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
rc=0

mkdir "$t/bin"
# docker: `ps` prints JOBS (a job container id, or nothing), every other call is logged.
cat >"$t/bin/docker" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = ps ]; then printf '%s' "${JOBS:-}"; exit 0; fi
echo "docker $*" >>"$LOG"
STUB
# df: prints the next capacity from USED (one per line), the last one repeating.
cat >"$t/bin/df" <<'STUB'
#!/usr/bin/env bash
used=$(head -n1 "$USED"); [ "$(wc -l <"$USED")" -gt 1 ] && sed -i.bak 1d "$USED"
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
echo "/dev/sda2 216000000 0 0 ${used}% /var/lib/docker"
STUB
chmod +x "$t/bin/docker" "$t/bin/df"

run() {
  : >"$t/log"
  printf '%s\n' "$@" >"$t/used"
  PATH="$t/bin:$PATH" LOG="$t/log" USED="$t/used" "$script" once >"$t/out"
}

check() {
  if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; rc=1; fi
}

check "39 % free is under the line" "'$script' needs 39"
check "40 % free is not" "! '$script' needs 40"

run 50
check "a box with half its disk free is left alone" "[ ! -s '$t/log' ]"

JOBS=abc123 run 100
check "nothing is pruned while a job container runs" "[ ! -s '$t/log' ]"

run 73 73
check "the gentle pass runs when 27 % is free" "grep -q 'builder prune -af --filter until=24h' '$t/log' && grep -qx 'docker image prune -f' '$t/log'"
check "and stays gentle while over 10 % is free, even under the line" "[ \"\$(grep -c . '$t/log')\" = 3 ]"
check "images are not pruned by age, which for an image is its creation" "! grep -q 'image prune.*until' '$t/log'"

run 95 92
check "the full pass follows when under 10 % is left" "grep -qx 'docker image prune -af' '$t/log' && grep -qx 'docker builder prune -af' '$t/log'"
check "volumes are never pruned" "! grep -q volume '$t/log'"

exit "$rc"

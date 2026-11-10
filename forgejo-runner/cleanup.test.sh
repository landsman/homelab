#!/usr/bin/env bash
# Tests what cleanup.sh would get wrong silently: pruning while a job runs (its images and build cache go mid-build),
# pruning a box that has room, reading df's columns wrong so it never acts, or stopping after the gentle pass when that
# freed too little. docker and df are stubs on PATH that record their calls; nothing reaches Docker.
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

run 73 50
check "the gentle pass runs when 27 % is free" "grep -q 'image prune -af --filter until=24h' '$t/log'"
check "and stops there when it freed enough" "[ \"\$(grep -c . '$t/log')\" = 3 ]"

run 90 80
check "the full pass follows when the gentle one left too little" "grep -qx 'docker image prune -af' '$t/log' && grep -qx 'docker builder prune -af' '$t/log'"
check "volumes are never pruned" "! grep -q volume '$t/log'"

exit "$rc"

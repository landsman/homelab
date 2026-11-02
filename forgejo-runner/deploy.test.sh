#!/usr/bin/env bash
# Tests what deploy.sh would get wrong silently: a box's own data or secrets copied over, a runner restarted while a
# job runs, a box left on the old wrapper reported as deployed, and one failing box hiding the others. rsync, ssh and
# docker are stubs on PATH that record their calls; nothing reaches a box.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/deploy.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
rc=0

# ssh runs its command here, the way the box would: `deploy.sh restart-when-idle` with the stubbed docker, or the
# wrapper's checksum, which is this checkout's unless STALE names the host.
mkdir "$t/bin"
cat >"$t/bin/rsync" <<'STUB'
#!/usr/bin/env bash
echo "rsync $*" >>"$LOG"
tr '\0' '\n' >>"$LOG.files"
STUB
cat >"$t/bin/ssh" <<'STUB'
#!/usr/bin/env bash
host=$1; shift
echo "ssh $host $*" >>"$LOG"
case "$*" in
  *restart-when-idle*) IDLE_POLL=0 IDLE_TIMEOUT="${IDLE_TIMEOUT:-5}" "$SCRIPT" restart-when-idle ;;
  *cksum*) if [ "${STALE:-}" = "$host" ]; then echo "1 2"; else cksum <"$WRAPPER"; fi ;;
esac
STUB
cat >"$t/bin/docker" <<'STUB'
#!/usr/bin/env bash
echo "docker $*" >>"$LOG"
if [ "$1" = ps ]; then
  left=$(cat "$JOBS")
  [ "$left" -gt 0 ] && { echo job; echo $((left - 1)) >"$JOBS"; }
fi
exit 0
STUB
chmod +x "$t/bin/"*

run() {
  : >"$t/log"
  : >"$t/log.files"
  echo "${JOBS:-0}" >"$t/jobs"
  set +e
  out=$(PATH="$t/bin:$PATH" LOG="$t/log" JOBS="$t/jobs" SCRIPT="$script" WRAPPER="$(dirname "$script")/runner/git" \
    STALE="${STALE:-}" IDLE_TIMEOUT="${TIMEOUT:-5}" "$script" "$@" 2>&1)
  status=$?
  set -e
}

verdict() {
  if [ "$2" = 0 ]; then echo "ok   $1"; else echo "FAIL $1 (status $status)"; printf '%s\n' "$out" | sed 's/^/  /'; rc=1; fi
}

# A checkout holding a box's files, as one used to set a box up might: none of them may leave it.
here=$(dirname "$script")
mkdir -p "$here/data"
for f in runner/config.yml .env data/x; do [ -e "$here/$f" ] || { : >"$here/$f"; made="${made:-} $f"; }; done
run a.test b.test
for f in ${made:-}; do rm -f "$here/$f"; done
rmdir "$here/data" 2>/dev/null || true
set +e
[ "$status" = 0 ] && grep -q "rsync -a --from0 --files-from=- .*/ a.test:forgejo-runner/" "$t/log" &&
  grep -qx deploy.sh "$t/log.files" && grep -qx runner/git "$t/log.files" &&
  ! grep -qE '^(runner/config.yml|\.env|data/.*)$' "$t/log.files"
verdict "a box gets the tracked files only, never a config, .env or data from the checkout" $?
[ "$(grep -c 'force-recreate runner' "$t/log")" = 2 ]
verdict "each box's runner is recreated, so it mounts the new files" $?
set -e

JOBS=2 run a.test
set +e
[ "$status" = 0 ] && [ "$(grep -c 'docker ps' "$t/log")" = 3 ] && grep -q force-recreate "$t/log"
verdict "a box running jobs is restarted only once they are done" $?
set -e

JOBS=9 TIMEOUT=0 run a.test
set +e
[ "$status" = 1 ] && ! grep -q force-recreate "$t/log" && grep -q "FAIL a.test" <<<"$out"
verdict "a box that stays busy is left alone and reported" $?
set -e

STALE=a.test run a.test b.test
set +e
[ "$status" = 1 ] && grep -q "FAIL a.test" <<<"$out" && grep -q "ok   b.test" <<<"$out"
verdict "a box left on another wrapper fails the run, and the next box is still deployed" $?
set -e

run
set +e
[ "$status" = 2 ] && [ ! -s "$t/log" ]
verdict "no host named, nothing touched" $?
set -e

exit "$rc"

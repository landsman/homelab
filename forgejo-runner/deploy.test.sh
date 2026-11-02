#!/usr/bin/env bash
# Tests what deploy.sh would get wrong silently: a box's own data or secrets copied over, a runner restarted while a
# job runs, a box left on the old wrapper reported as deployed, and one failing box hiding the others. rsync, ssh and
# docker are stubs on PATH that record their calls; nothing reaches a box.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/deploy.sh"
t=$(mktemp -d)
here=$(dirname "$script")
made=''
# Two checks put files into this very checkout: a box's config, .env and data, and a file moved away. They are taken
# back on any exit, Ctrl-C included, as left behind they are the files the deploy must never copy.
cleanup() {
  for f in $made; do rm -f "$here/$f"; done
  [ -z "${made_data:-}" ] || rmdir "$here/data"
  [ ! -e "$t/CAVEATS.md" ] || mv "$t/CAVEATS.md" "$here/CAVEATS.md"
  rm -rf "$t"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
rc=0

# ssh runs its command here, the way the box would: `deploy.sh restart-when-idle` with the stubbed docker, or the
# wrapper's checksum, which is this checkout's unless STALE names the host.
real_git=$(command -v git)
mkdir "$t/bin"
cat >"$t/bin/rsync" <<'STUB'
#!/usr/bin/env bash
echo "rsync $*" >>"$LOG"
cat >>"$LOG.files"
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
# git as it is, unless BROKEN names it failing the way an unsafe checkout does.
cat >"$t/bin/git" <<'STUB'
#!/usr/bin/env bash
[ -z "${BROKEN:-}" ] || { echo "fatal: detected dubious ownership" >&2; exit 128; }
exec "$REAL_GIT" "$@"
STUB
chmod +x "$t/bin/"*

run() {
  : >"$t/log"
  : >"$t/log.files"
  echo "${JOBS:-0}" >"$t/jobs"
  set +e
  out=$(REAL_GIT="$real_git" BROKEN="${BROKEN:-}" PATH="$t/bin:$PATH" LOG="$t/log" JOBS="$t/jobs" SCRIPT="$script" WRAPPER="$(dirname "$script")/runner/git" \
    STALE="${STALE:-}" IDLE_TIMEOUT="${TIMEOUT:-5}" "$script" "$@" 2>&1)
  status=$?
  set -e
}

# One line per behaviour, the one named in $it: ok, or FAIL with what the script printed.
it=''
pass() { echo "ok   $it"; }
fail() {
  echo "FAIL $it (status $status)"
  printf '%s\n' "$out" | sed 's/^/  /'
  rc=1
}

# A checkout holding a box's files, as one used to set a box up might: none of them may leave it.
[ -d "$here/data" ] || { mkdir "$here/data"; made_data=1; }
for f in runner/config.yml .env data/x; do [ -e "$here/$f" ] || { : >"$here/$f"; made="$made $f"; }; done
run a.test b.test
for f in $made; do rm -f "$here/$f"; done
made=''
[ -z "${made_data:-}" ] || rmdir "$here/data"
made_data=
it="a box gets the tracked files only, never a config, .env or data from the checkout"
if [ "$status" = 0 ] && grep -q "rsync -a --files-from=- .*/ a.test:forgejo-runner/" "$t/log" &&
  grep -qx deploy.sh "$t/log.files" && grep -qx runner/git "$t/log.files" &&
  ! grep -qE '^(runner/config.yml|\.env|data/.*)$' "$t/log.files"; then pass; else fail; fi
it="each box's runner is recreated, so it mounts the new files"
if [ "$(grep -c 'force-recreate runner' "$t/log")" = 2 ]; then pass; else fail; fi

# A tracked file deleted in the checkout but not yet in git: listed, rsync would fail the box on it.
mv "$here/CAVEATS.md" "$t/CAVEATS.md"
run a.test
mv "$t/CAVEATS.md" "$here/CAVEATS.md"
it="a file deleted in the checkout is left out, not a failed box"
if [ "$status" = 0 ] && ! grep -qx CAVEATS.md "$t/log.files" && grep -qx deploy.sh "$t/log.files"; then pass; else fail; fi

BROKEN=1 run a.test
it="a box whose file list git cannot give fails before anything is copied or restarted"
if [ "$status" != 0 ] && ! grep -q '^rsync\|force-recreate' "$t/log"; then pass; else fail; fi

JOBS=2 run a.test
it="a box running jobs is restarted only once they are done"
if [ "$status" = 0 ] && [ "$(grep -c 'docker ps' "$t/log")" = 3 ] && grep -q force-recreate "$t/log"; then pass; else fail; fi

JOBS=9 TIMEOUT=0 run a.test
it="a box that stays busy is left alone and reported"
if [ "$status" = 1 ] && ! grep -q force-recreate "$t/log" && grep -q "FAIL a.test" <<<"$out"; then pass; else fail; fi

STALE=a.test run a.test b.test
it="a box left on another wrapper fails the run, and the next box is still deployed"
if [ "$status" = 1 ] && grep -q "FAIL a.test" <<<"$out" && grep -q "ok   b.test" <<<"$out"; then pass; else fail; fi

run
it="no host named, nothing touched"
if [ "$status" = 2 ] && [ ! -s "$t/log" ]; then pass; else fail; fi

cleanup
trap - EXIT
exit "$rc"

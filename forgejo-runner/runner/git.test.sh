#!/usr/bin/env bash
# Tests what the git wrapper would get wrong silently: an action fetch that fails on another job's lock instead of
# waiting for it, a real failure retried as if it were a lock, a job's own checkout touched at all, and the tailnet
# rewrite lost on the way. A stub stands in for git and records every call; nothing here needs a network.
set -euo pipefail

wrapper="$(cd "$(dirname "$0")" && pwd)/git"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
rc=0

# The stub fails with a lock message while $t/locked counts down, then prints "fetched" and succeeds.
cat >"$t/git" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$STUB_LOG"
# Hanging, it starts a helper first, the way a fetch starts git-remote-https, and records both.
if [ -n "${STUB_HANG:-}" ]; then sleep 30 & echo $! >"$STUB_HANG.helper"; echo $$ >"$STUB_HANG"; exec sleep 30; fi
if [ -n "${STUB_FAIL:-}" ]; then echo "fatal: $STUB_FAIL" >&2; exit 128; fi
left=$(cat "$STUB_LOCKED" 2>/dev/null || echo 0)
if [ "$left" -gt 0 ]; then
  echo $((left - 1)) >"$STUB_LOCKED"
  echo "fatal: Unable to create '/data/.cache/act/7e/x/shallow.lock': File exists." >&2
  exit 128
fi
echo fetched
STUB
chmod +x "$t/git"

# The runner's config, as runner/config.example.yml shapes it: the instance it connects to.
printf "server:\n  connections:\n    forgejo:\n      url: 'https://forge.test/'\n" >"$t/config.yml"

# From here a failing command is a finding, not an error: the wrapper is meant to fail in some of these.
set +e

run() {
  : >"$t/log"
  echo "${LOCKED:-0}" >"$t/locked"
  out=$(GIT_REAL="$t/git" GIT_LOCK_WAIT=0 GIT_LOCK_TRIES=5 STUB_LOG="$t/log" STUB_LOCKED="$t/locked" \
    STUB_FAIL="${FAIL:-}" FORGEJO_INTERNAL_URL="${INTERNAL:-}" RUNNER_CONFIG="${CONFIG:-$t/config.yml}" \
    "$wrapper" "$@" 2>"$t/err")
  status=$?
  calls=$(wc -l <"$t/log" | tr -d ' ')
}

# One line per behaviour, the one named in $it: ok, or FAIL with what the wrapper did.
it=''
pass() { echo "ok   $it"; }
fail() {
  echo "FAIL $it (status $status, calls $calls, out '$out')"
  rc=1
}

LOCKED=2 run --no-replace-objects fetch origin
it="an action fetch waits out another job's lock and succeeds"
if [ "$status" = 0 ] && [ "$calls" = 3 ] && [ "$out" = fetched ]; then pass; else fail; fi

LOCKED=9 run --no-replace-objects fetch origin
it="it gives up after GIT_LOCK_TRIES and shows git's own error"
if [ "$status" = 128 ] && [ "$calls" = 5 ] && grep -q shallow.lock "$t/err"; then pass; else fail; fi

FAIL="repository not found" run --no-replace-objects fetch origin
it="any other failure is passed on at once, not retried"
if [ "$status" = 128 ] && [ "$calls" = 1 ] && grep -q "repository not found" "$t/err"; then pass; else fail; fi

LOCKED=2 run checkout main
it="a job's own git call is neither retried nor rewritten"
if [ "$status" = 128 ] && [ "$calls" = 1 ] && grep -qx "checkout main" "$t/log"; then pass; else fail; fi

INTERNAL=https://nas.test run --no-replace-objects fetch origin
it="an action fetch goes to the tailnet mirror, for the instance the runner's config names"
if grep -q "url.https://nas.test/tools-mirror/.insteadOf=https://forge.test/tools-mirror/" "$t/log"; then pass; else fail; fi

INTERNAL=https://nas.test CONFIG="$t/missing.yml" run --no-replace-objects fetch origin
it="with no instance in the config it rewrites nothing and says so"
if [ "$status" = 0 ] && ! grep -q insteadOf "$t/log" && grep -q "no forgejo url" "$t/err"; then pass; else fail; fi

INTERNAL=https://nas.test run --no-replace-objects remote get-url origin
it="remote get-url is not rewritten, so the cached clone is reused"
if ! grep -q insteadOf "$t/log"; then pass; else fail; fi

# A cancelled job: the runner sends TERM to the wrapper while git hangs. git must go with it.
: >"$t/log"
GIT_REAL="$t/git" STUB_LOG="$t/log" STUB_HANG="$t/hang.pid" "$wrapper" --no-replace-objects fetch origin 2>/dev/null &
wrapper_pid=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do [ -s "$t/hang.pid" ] && break; sleep 0.2; done
kill -TERM "$wrapper_pid"
wait "$wrapper_pid" 2>/dev/null
sleep 0.3
status=0 calls=1 out=''
it="a cancelled job's git is stopped with it, and holds no lock afterwards"
if ! kill -0 "$(cat "$t/hang.pid")" 2>/dev/null; then pass; else fail; fi
it="a helper git started is stopped too, not left running"
if ! kill -0 "$(cat "$t/hang.pid.helper")" 2>/dev/null; then pass; else fail; fi

exit "$rc"

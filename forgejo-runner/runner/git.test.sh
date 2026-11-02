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

# From here a failing command is a finding, not an error: the wrapper is meant to fail in some of these.
set +e

run() {
  : >"$t/log"
  echo "${LOCKED:-0}" >"$t/locked"
  out=$(GIT_REAL="$t/git" GIT_LOCK_WAIT=0 GIT_LOCK_TRIES=5 STUB_LOG="$t/log" STUB_LOCKED="$t/locked" \
    STUB_FAIL="${FAIL:-}" FORGEJO_INTERNAL_URL="${INTERNAL:-}" "$wrapper" "$@" 2>"$t/err")
  status=$?
  calls=$(wc -l <"$t/log" | tr -d ' ')
}

# One line per behaviour: ok when the condition before it held, FAIL with what the wrapper did otherwise.
verdict() {
  if [ "$2" = 0 ]; then echo "ok   $1"; else echo "FAIL $1 (status $status, calls $calls, out '$out')"; rc=1; fi
}

LOCKED=2 run --no-replace-objects fetch origin
[ "$status" = 0 ] && [ "$calls" = 3 ] && [ "$out" = fetched ]
verdict "an action fetch waits out another job's lock and succeeds" $?

LOCKED=9 run --no-replace-objects fetch origin
[ "$status" = 128 ] && [ "$calls" = 5 ] && grep -q shallow.lock "$t/err"
verdict "it gives up after GIT_LOCK_TRIES and shows git's own error" $?

FAIL="repository not found" run --no-replace-objects fetch origin
[ "$status" = 128 ] && [ "$calls" = 1 ] && grep -q "repository not found" "$t/err"
verdict "any other failure is passed on at once, not retried" $?

LOCKED=2 run checkout main
[ "$status" = 128 ] && [ "$calls" = 1 ] && grep -qx "checkout main" "$t/log"
verdict "a job's own git call is neither retried nor rewritten" $?

INTERNAL=https://nas.test run --no-replace-objects fetch origin
grep -q "url.https://nas.test/tools-mirror/.insteadOf=https://git.insuit.cz/tools-mirror/" "$t/log"
verdict "an action fetch goes to the tailnet mirror when it is set" $?

INTERNAL=https://nas.test run --no-replace-objects remote get-url origin
grep -q insteadOf "$t/log"
[ $? = 1 ]
verdict "remote get-url is not rewritten, so the cached clone is reused" $?

exit "$rc"

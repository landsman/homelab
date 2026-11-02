#!/usr/bin/env bash
# Tests what the git wrapper would get wrong silently: an action fetch that fails on another job's lock instead of
# waiting for it, a real failure retried as if it were a lock, a job's own checkout touched at all, and the tailnet
# rewrite lost on the way. A stub stands in for git and records every call; nothing here needs a network.
set -euo pipefail

wrapper="$(cd "$(dirname "$0")" && pwd)/git"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
rc=0

# The stub fails on the lock file while it exists, the way git does, and prints "fetched" once it is gone. Another
# holder lets go of it once $t/locked counts down to zero; a killed one never does.
cat >"$t/git" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$STUB_LOG"
if [ -n "${STUB_FAIL:-}" ]; then echo "fatal: $STUB_FAIL" >&2; exit 128; fi
left=$(cat "$STUB_LOCKED" 2>/dev/null || echo 0)
[ "$left" != 0 ] || rm -f "$STUB_LOCK"
if [ -e "$STUB_LOCK" ]; then
  echo $((left - 1)) >"$STUB_LOCKED"
  echo "fatal: Unable to create '$STUB_LOCK': File exists." >&2
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
  rm -f "$t/shallow.lock"
  [ -z "${LOCK:-}" ] || touch -t "$LOCK" "$t/shallow.lock"
  out=$(GIT_REAL="$t/git" GIT_LOCK_WAIT=0 GIT_LOCK_TRIES=5 STUB_LOG="$t/log" STUB_LOCKED="$t/locked" STUB_LOCK="$t/shallow.lock" \
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

LOCK=$(date +%Y%m%d%H%M.%S) LOCKED=2 run --no-replace-objects fetch origin
it="an action fetch waits out a lock another git still holds, and succeeds"
if [ "$status" = 0 ] && [ "$calls" = 3 ] && [ "$out" = fetched ]; then pass; else fail; fi

LOCK=$(date +%Y%m%d%H%M.%S) LOCKED=-1 run --no-replace-objects fetch origin
it="a fresh lock is never removed: it gives up after GIT_LOCK_TRIES with git's own error"
if [ "$status" = 128 ] && [ "$calls" = 5 ] && [ -e "$t/shallow.lock" ] && grep -q shallow.lock "$t/err"; then pass; else fail; fi

LOCK=202001010000 LOCKED=-1 run --no-replace-objects fetch origin
it="a lock left by a killed git is removed, and the fetch goes through"
if [ "$status" = 0 ] && [ "$calls" = 2 ] && [ "$out" = fetched ] && grep -q "removing .*shallow.lock" "$t/err"; then pass; else fail; fi

FAIL="repository not found" run --no-replace-objects fetch origin
it="any other failure is passed on at once, not retried"
if [ "$status" = 128 ] && [ "$calls" = 1 ] && grep -q "repository not found" "$t/err"; then pass; else fail; fi

LOCK=202001010000 LOCKED=-1 run checkout main
it="a job's own git call is neither retried, nor has a lock removed, nor is rewritten"
if [ "$status" = 128 ] && [ "$calls" = 1 ] && [ -e "$t/shallow.lock" ] && grep -qx "checkout main" "$t/log"; then pass; else fail; fi

INTERNAL=https://nas.test run --no-replace-objects fetch origin
it="an action fetch goes to the tailnet mirror, for the instance the runner's config names"
if grep -q "url.https://nas.test/tools-mirror/.insteadOf=https://forge.test/tools-mirror/" "$t/log"; then pass; else fail; fi

INTERNAL=https://nas.test CONFIG="$t/missing.yml" run --no-replace-objects fetch origin
it="with no instance in the config it rewrites nothing and says so"
if [ "$status" = 0 ] && ! grep -q insteadOf "$t/log" && grep -q "no forgejo url" "$t/err"; then pass; else fail; fi

INTERNAL=https://nas.test run --no-replace-objects remote get-url origin
it="remote get-url is not rewritten, so the cached clone is reused"
if ! grep -q insteadOf "$t/log"; then pass; else fail; fi

exit "$rc"

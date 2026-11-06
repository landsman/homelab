#!/bin/sh
# Tests the two decisions in setup/postmortem.sh that would mislead silently:
#   - ended-clean: a clean poweroff taken for a crash sends you hunting a
#     hardware fault that is not there; a crash taken for a clean poweroff
#     hides one
#   - verdict: which evidence wins when there is more than one
# Both journal tails are real ones from saul.
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
POSTMORTEM="$SCRIPT_DIR/../src/setup/postmortem.sh"

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ok  — $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL — $1"; }

CLEAN='Oct 28 19:20:12 saul systemd[1]: Shutting down.
Oct 28 19:20:13 saul systemd-shutdown[1]: Syncing filesystems and block devices.
Oct 28 19:20:13 saul systemd-journald[334]: Received SIGTERM from PID 1 (systemd-shutdow).
Oct 28 19:20:13 saul systemd-journald[334]: Journal stopped'

CRASH='Nov 06 09:32:58 saul tailscaled[679]: dns: resolve.conf was trampled, setting existing config again
Nov 06 09:32:58 saul tailscaled[679]: trample: resolv.conf again matches expected content
Nov 06 09:32:58 saul tailscaled[679]: health(warnable=resolv-conf-overwritten): ok'

if printf '%s\n' "$CLEAN" | sh "$POSTMORTEM" ended-clean; then pass "a poweroff counts as clean"; else fail "a poweroff counts as clean"; fi
if printf '%s\n' "$CRASH" | sh "$POSTMORTEM" ended-clean; then fail "a log that just stops is not clean"; else pass "a log that just stops is not clean"; fi
if printf '' | sh "$POSTMORTEM" ended-clean; then fail "an empty log is not clean"; else pass "an empty log is not clean"; fi

says() {
    out=$(sh "$POSTMORTEM" verdict "$1" "$2")
    case "$out" in "$3"*) pass "$4" ;; *) fail "$4 (got: $out)" ;; esac
}

# iTCO reports no reset flag (it clears it at probe), so no evidence is either
says 0 0 "power lost, or a hang the watchdog reset" "no evidence names both a power loss and a watchdog reset"
says 0 1 "kernel panic" "a saved dump is a panic"
says 1 0 "clean shutdown" "a shutdown with no dump is clean"
says 1 1 "kernel panic" "a panic during shutdown is a panic"

# install copies itself to /usr/local/sbin, so from a pipe ($0 is "sh") it must
# stop before apt-get rather than halfway through
if out=$(sh -s install < "$POSTMORTEM" 2>&1); then
    fail "a piped install stops (it exited 0)"
else
    case "$out" in *"wget -O postmortem.sh"*) pass "a piped install stops and says to download it first" ;;
        *) fail "a piped install stops and says to download it first (got: $out)" ;; esac
fi

echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

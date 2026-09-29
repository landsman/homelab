#!/bin/sh
# Tests the version gate in setup/006-health-sidecar.sh: the unit passes the
# token with --token-file, which cloudflared only has from 2025.4.0. A wrong
# comparison installs a unit that crash-loops on an unknown flag, so pin it
# down here — no root, no network, no cloudflared needed.
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SIDECAR="$SCRIPT_DIR/../src/setup/006-health-sidecar.sh"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ok  — $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL — $1"; }

accepts() {
    if sh "$SIDECAR" version-ok "$1" >/dev/null 2>&1; then pass "accepts $1"; else fail "should accept $1"; fi
}

rejects() {
    if sh "$SIDECAR" version-ok "$1" >/dev/null 2>&1; then fail "should reject '$1'"; else pass "rejects '$1'"; fi
}

accepts 2025.4.0
accepts 2025.10.0  # numeric, not lexical: 10 > 4
accepts 2026.1.0
accepts 2026.7.1

rejects 2025.3.9
rejects 2024.12.2
rejects 2025.4     # unparseable is a failure, never a pass
rejects abc
rejects ""

echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

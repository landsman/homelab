#!/bin/sh
# Tests the two decisions in setup/003-monitoring.sh that fail silently:
#   - the version gate: the unit passes the token with --token-file, which
#     cloudflared only has from 2025.4.0; a wrong comparison installs a unit
#     that crash-loops on an unknown flag
#   - same-tunnel: whether an existing cloudflared.service is an old health
#     connector for this tunnel (replace it) or a main tunnel (leave it); a
#     wrong answer takes a host's published apps offline
# No root, no network, no cloudflared needed.
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
MONITORING="$SCRIPT_DIR/../src/setup/003-monitoring.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ok  — $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL — $1"; }

accepts() {
    if sh "$MONITORING" version-ok "$1" >/dev/null 2>&1; then pass "accepts $1"; else fail "should accept $1"; fi
}

rejects() {
    if sh "$MONITORING" version-ok "$1" >/dev/null 2>&1; then fail "should reject '$1'"; else pass "rejects '$1'"; fi
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

# connector tokens are base64 of {"a":account,"t":tunnel,"s":secret}; the
# 26-byte secret makes the encoding need padding, as real tokens do
token() { printf '{"a":"acct","t":"%s","s":"c2VjcmV0c2VjcmV0c2VjcmV0"}' "$1" | base64 | tr -d '\n='; }
HEALTH=$(token 11111111-aaaa-bbbb-cccc-000000000001)
MAIN=$(token 22222222-aaaa-bbbb-cccc-000000000002)

unit() { printf '[Service]\nExecStart=%s\n' "$2" > "$TMP/$1"; echo "$TMP/$1"; }

same() {
    if sh "$MONITORING" same-tunnel "$1" "$2" >/dev/null 2>&1; then pass "$3"; else fail "$3"; fi
}

differs() {
    if sh "$MONITORING" same-tunnel "$1" "$2" >/dev/null 2>&1; then fail "$3"; else pass "$3"; fi
}

same "$(unit old-inline "/usr/bin/cloudflared --no-autoupdate tunnel run --token $HEALTH")" "$HEALTH" \
    "an old inline-token unit of the same tunnel is replaced"

printf '%s\n' "$HEALTH" > "$TMP/token"
same "$(unit old-file "/usr/bin/cloudflared --no-autoupdate tunnel run --token-file $TMP/token")" "$HEALTH" \
    "a 2026.7.2+ --token-file unit of the same tunnel is replaced"

differs "$(unit main-inline "/usr/bin/cloudflared --no-autoupdate tunnel run --token $MAIN")" "$HEALTH" \
    "a main tunnel's unit is left alone"

printf '%s\n' "$MAIN" > "$TMP/main-token"
differs "$(unit main-file "/usr/bin/cloudflared --no-autoupdate tunnel run --token-file $TMP/main-token")" "$HEALTH" \
    "a main tunnel's --token-file unit is left alone"

differs "$(unit no-token "/usr/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run")" "$HEALTH" \
    "a config-file tunnel with no token is left alone"

differs "$TMP/missing" "$HEALTH" "a missing unit file is not a match"

differs "$(unit garbage "/usr/bin/cloudflared tunnel run --token not-a-token")" "not-a-token" \
    "two tokens that decode to nothing never count as the same tunnel"

echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

#!/bin/sh
# Tests for cli/pages.sh — the static-site generator.
# Runs a real `make build` into the working tree's public/ and asserts the
# generator's invariants for the /setup/ listing, raw-file headers and aliases.
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)

PASS=0
FAIL=0

assert_contains() {
    label=$1
    file=$2
    needle=$3
    if [ -f "$file" ] && grep -qF "$needle" "$file"; then
        PASS=$((PASS + 1))
        echo "  ok  — $label"
    else
        FAIL=$((FAIL + 1))
        echo "  FAIL — $label"
        echo "    expected substring: $needle"
        echo "    in file: $file"
    fi
}

assert_exists() {
    label=$1
    file=$2
    if [ -f "$file" ]; then
        PASS=$((PASS + 1))
        echo "  ok  — $label"
    else
        FAIL=$((FAIL + 1))
        echo "  FAIL — $label (missing: $file)"
    fi
}

# Assert that an exact line exists in _headers immediately followed by the
# text/plain content-type — i.e. the path got a raw-file rule, not just a
# stray mention.
assert_raw_header() {
    label=$1
    path=$2
    if awk -v p="$path" '
        $0 == p { seen = 1; next }
        seen && /^  Content-Type: text\/plain/ { ok = 1; exit }
        seen && NF { seen = 0 }
        END { exit ok ? 0 : 1 }
    ' "$ROOT/public/_headers"; then
        PASS=$((PASS + 1))
        echo "  ok  — $label"
    else
        FAIL=$((FAIL + 1))
        echo "  FAIL — $label (no text/plain rule for $path)"
    fi
}

cd "$ROOT"
make build >/dev/null

# --- raw non-.sh setup files (mise.toml) behave like scripts -----------------
assert_exists      "mise.toml copied into public/setup" "public/setup/mise.toml"
assert_contains    "mise.toml matches source"           "public/setup/mise.toml" "[tools]"
assert_contains    "mise.toml listing link is hx-boost=\"false\"" \
                   "public/setup/index.html" '<a href="mise.toml" hx-boost="false">'
assert_raw_header  "mise.toml served as text/plain"      "/setup/mise.toml"

# --- .sh scripts get a stripped alias + raw-file header ----------------------
assert_exists      "001-init.sh alias copied to /init.sh" "public/init.sh"
assert_contains    "init.sh listing link is hx-boost=\"false\"" \
                   "public/setup/index.html" 'hx-boost="false">001-init.sh'
assert_raw_header  "init.sh alias served as text/plain"  "/init.sh"

# --- the listing actually rendered -------------------------------------------
assert_exists      "/setup/ index rendered"              "public/setup/index.html"

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

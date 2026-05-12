#!/bin/sh
# Tests for docker/30-substitute-base-path.sh
# Runs the substitution script against fixture index.html files in a tmpdir.
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
TARGET="$SCRIPT_DIR/../../docker/30-substitute-base-path.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

PASS=0
FAIL=0

fixture() {
    cat > "$1" <<'EOF'
<!doctype html>
<base href="/">
<script>window.__BASE_PATH__ = '/';</script>
EOF
}

assert_contains() {
    label=$1
    file=$2
    needle=$3
    if grep -qF "$needle" "$file"; then
        PASS=$((PASS + 1))
        echo "  ok  — $label"
    else
        FAIL=$((FAIL + 1))
        echo "  FAIL — $label"
        echo "    expected substring: $needle"
        echo "    file contents:"
        sed 's/^/      /' "$file"
    fi
}

run_case() {
    label=$1
    base=$2
    expect=$3
    index="$TMPDIR/index.html"
    fixture "$index"
    BASE_PATH="$base" INDEX="$index" sh "$TARGET" > /dev/null
    assert_contains "$label" "$index" "$expect"
}

assert_rejects() {
    label=$1
    base=$2
    index="$TMPDIR/index.html"
    fixture "$index"
    if BASE_PATH="$base" INDEX="$index" sh "$TARGET" > /dev/null 2>&1; then
        FAIL=$((FAIL + 1))
        echo "  FAIL — $label (expected non-zero exit, got 0)"
    else
        PASS=$((PASS + 1))
        echo "  ok  — $label"
    fi
}

echo "substitute-base-path tests"

# Default '/' → no-op rewrite (replaces / with /)
index="$TMPDIR/index.html"
fixture "$index"
INDEX="$index" sh "$TARGET" > /dev/null
assert_contains "default BASE_PATH no-op (__BASE_PATH__)" "$index" "window.__BASE_PATH__ = '/';"
assert_contains "default BASE_PATH no-op (<base>)" "$index" '<base href="/">'

# Subpath rewrites both tokens
run_case "subpath rewrites __BASE_PATH__" "/dashboard/" "window.__BASE_PATH__ = '/dashboard/';"
index="$TMPDIR/index.html"
fixture "$index"
BASE_PATH="/dashboard/" INDEX="$index" sh "$TARGET" > /dev/null
assert_contains "subpath rewrites <base>" "$index" '<base href="/dashboard/">'

# Validation: unsafe chars must be rejected before any rewrite happens.
assert_rejects "rejects single quote" "/a'b/"
assert_rejects "rejects double quote" '/a"b/'
assert_rejects "rejects backslash"    '/a\b/'
assert_rejects "rejects angle bracket" "/a<b/"
assert_rejects "rejects ampersand"    "/a&b/"
assert_rejects "rejects pipe"         "/a|b/"
assert_rejects "rejects whitespace"   "/a b/"

echo
echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]

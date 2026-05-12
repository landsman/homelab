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

echo "substitute-base-path tests"

# Default '/' → no-op rewrite (replaces / with /)
index="$TMPDIR/index.html"
fixture "$index"
INDEX="$index" sh "$TARGET" > /dev/null
assert_contains "default BASE_PATH is no-op" "$index" "window.__BASE_PATH__ = '/';"

# Subpath → clean output, no escaped slashes
run_case "subpath rewrites cleanly" "/welcome-page/" "window.__BASE_PATH__ = '/welcome-page/';"

# '&' in path → must be escaped (literal & in HTML, not sed backref)
run_case "ampersand stays literal" "/a&b/" "window.__BASE_PATH__ = '/a&b/';"

# '|' (sed delimiter) → must be escaped, ends up literal in HTML
run_case "pipe in path stays literal" "/a|b/" "window.__BASE_PATH__ = '/a|b/';"

echo
echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]

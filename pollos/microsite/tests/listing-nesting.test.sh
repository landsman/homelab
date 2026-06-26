#!/bin/sh
# Tests cli/pages.sh nesting/standalone logic against a fixture setup dir of
# config files with assorted extensions (pointed at via SETUP_SRC):
#   - configs a script references by name nest under it as children
#   - configs nothing references list standalone
#   - every non-.sh file, whatever its extension, is served raw (text/plain)
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ok  — $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL — $1"; }

# A child <li> for <file> nested under <script>: same line carries the child
# class, the file link and the "fetched by <script>" note.
assert_child() {
    if grep -q "class=\"child\".*href=\"$1\".*fetched by $2" "$IDX"; then
        pass "$1 nested under $2"
    else
        fail "$1 should nest under $2"
    fi
}

# A standalone <li> for <file>: present, but not a child and not noted.
assert_standalone() {
    line=$(grep "href=\"$1\"" "$IDX" || true)
    if [ -n "$line" ] && ! printf '%s' "$line" | grep -q 'class="child"'; then
        pass "$1 listed standalone"
    else
        fail "$1 should list standalone (got: ${line:-<missing>})"
    fi
}

# <path> has a text/plain rule in _headers (served raw, like the scripts).
assert_raw_header() {
    if awk -v p="$1" '
        $0 == p { seen = 1; next }
        seen && /^  Content-Type: text\/plain/ { ok = 1; exit }
        seen && NF { seen = 0 }
        END { exit ok ? 0 : 1 }
    ' "$HDR"; then
        pass "$1 served as text/plain"
    else
        fail "$1 missing text/plain rule"
    fi
}

assert_hx_boost() {
    if grep -q "href=\"$1\" hx-boost=\"false\"" "$IDX"; then
        pass "$1 link is hx-boost=\"false\""
    else
        fail "$1 link missing hx-boost=\"false\""
    fi
}

# --- fixture setup dir: 1 script + 5 configs of assorted extensions ----------
FIX=$(mktemp -d)
trap 'rm -rf "$FIX"' EXIT

cat > "$FIX/100-fixture.sh" <<'EOF'
#!/bin/sh
# fixture script that fetches two of the configs by name
curl -fsSL https://example.test/app.conf -o /etc/app.conf
wget -qO- https://example.test/data.json
EOF
printf 'referenced\n'      > "$FIX/app.conf"     # referenced -> child
printf '{}\n'              > "$FIX/data.json"    # referenced -> child
printf 'orphan: true\n'    > "$FIX/orphan.yaml"  # unreferenced -> standalone
printf '# notes\n'         > "$FIX/notes.md"     # unreferenced -> standalone
printf '[section]\n'       > "$FIX/settings.ini" # unreferenced -> standalone

cd "$ROOT"
SETUP_SRC="$FIX" make build >/dev/null

IDX="$ROOT/public/setup/index.html"
HDR="$ROOT/public/_headers"

# referenced configs nest under the fixture script
assert_child "app.conf"  "100-fixture.sh"
assert_child "data.json" "100-fixture.sh"

# unreferenced configs stay standalone
assert_standalone "orphan.yaml"
assert_standalone "notes.md"
assert_standalone "settings.ini"

# every extension is served raw + navigates instead of htmx-swapping
for f in app.conf data.json orphan.yaml notes.md settings.ini; do
    assert_raw_header "/setup/$f"
    assert_hx_boost "$f"
done

# rebuild from the real source so we don't leave fixture output behind
make build >/dev/null

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

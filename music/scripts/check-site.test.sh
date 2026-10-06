#!/usr/bin/env bash
# The entry script is what "this build" means, so finding it is the decision
# that would otherwise fail silently: no match would make every page look wrong.
set -euo pipefail
cd "$(dirname "$0")"
f=$(mktemp)
cat > "$f" <<'EOF'
<link rel="modulepreload" href="./assets/howler-ASXssgn1.js">
<script type="module" crossorigin src="./assets/index-D1lOejmJ.js"></script>
EOF
got=$(./check-site.sh entry "$f")
rm -f "$f"
[ "$got" = "assets/index-D1lOejmJ.js" ] || { echo "got: $got" >&2; exit 1; }
echo "ok    check-site entry"

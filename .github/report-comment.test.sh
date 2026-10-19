#!/usr/bin/env bash
# The link comes out of cucumber-js's box, and a log without one yields nothing
# rather than failing — a failure there would hide the test failure itself.
set -euo pipefail
cd "$(dirname "$0")"

got=$(./report-comment.sh url <<'EOF'
22 scenarios (1 failed, 21 passed)
┌──────────────────────────────────────────────────────────────────────────┐
│ View your Cucumber Report at:                                            │
│ https://reports.cucumber.io/reports/2101b08b-f1f5-42dd-adfb-9e57aa86cd86 │
│                                                                          │
│ This report will self-destruct in 24h.                                   │
└──────────────────────────────────────────────────────────────────────────┘
EOF
)
want=https://reports.cucumber.io/reports/2101b08b-f1f5-42dd-adfb-9e57aa86cd86
[ "$got" = "$want" ] || { printf 'want: %s\ngot:  %s\n' "$want" "$got" >&2; exit 1; }
echo "ok    report-comment url"

got=$(echo "22 scenarios (22 passed)" | ./report-comment.sh url)
[ -z "$got" ] || { printf 'want nothing, got: %s\n' "$got" >&2; exit 1; }
echo "ok    report-comment url, nothing published"

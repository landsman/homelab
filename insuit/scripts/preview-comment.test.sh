#!/usr/bin/env bash
# Only the bot's own preview comments get hidden — never a person's, never
# another bot comment.
set -euo pipefail
cd "$(dirname "$0")"

got=$(./preview-comment.sh stale <<'EOF'
[
  {"node_id": "A", "user": {"login": "github-actions[bot]"}, "body": "insuit.cz preview: https://a.example (commit 1)"},
  {"node_id": "B", "user": {"login": "landsman"}, "body": "insuit.cz preview: looks good"},
  {"node_id": "C", "user": {"login": "github-actions[bot]"}, "body": "Terraform plan: no changes"},
  {"node_id": "D", "user": {"login": "github-actions[bot]"}, "body": "insuit.cz preview: https://b.example (commit 2)"}
]
EOF
)
want=$'A\nD'
[ "$got" = "$want" ] || { printf 'want:\n%s\ngot:\n%s\n' "$want" "$got" >&2; exit 1; }
echo "ok    preview-comment stale"

# Another site's marker hides only its own links, not insuit's.
got=$(PREVIEW_MARKER="music.insuit.cz preview:" ./preview-comment.sh stale <<'EOF'
[
  {"node_id": "A", "user": {"login": "github-actions[bot]"}, "body": "insuit.cz preview: https://a.example (commit 1)"},
  {"node_id": "M", "user": {"login": "github-actions[bot]"}, "body": "music.insuit.cz preview: https://m.example (commit 1)"}
]
EOF
)
[ "$got" = "M" ] || { printf 'want: M\ngot:\n%s\n' "$got" >&2; exit 1; }
echo "ok    preview-comment stale, per site"

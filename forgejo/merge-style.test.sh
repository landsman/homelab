#!/usr/bin/env bash
# Tests the one decision in merge-style.sh that fails silently: which repositories `apply` touches.
# A repository wrongly left out keeps its merge button; one wrongly picked fails the run on an
# archived repository. No network, no Forgejo — only jq.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/merge-style.sh"

done_='"allow_merge_commits":false,"allow_rebase_explicit":false,"allow_squash_merge":true,"default_merge_style":"squash"'
open='"archived":false,"mirror":false,"has_pull_requests":true'
want="o/merge
o/rebase-merge
o/no-squash
o/default-merge"

got=$(sh "$script" pick <<JSON
[
  {"full_name":"o/done",          $open, $done_},
  {"full_name":"o/merge",         $open, $done_, "allow_merge_commits":true},
  {"full_name":"o/rebase-merge",  $open, $done_, "allow_rebase_explicit":true},
  {"full_name":"o/no-squash",     $open, $done_, "allow_squash_merge":false},
  {"full_name":"o/default-merge", $open, $done_, "default_merge_style":"merge"},
  {"full_name":"o/archived",      $open, "archived":true,           "allow_merge_commits":true},
  {"full_name":"o/mirror",        $open, "mirror":true,             "allow_merge_commits":true},
  {"full_name":"o/no-pulls",      $open, "has_pull_requests":false, "allow_merge_commits":true}
]
JSON
)

if [ "$got" = "$want" ]; then
	echo "ok   pick changes exactly the repositories not set up yet"
else
	printf 'FAIL pick\n  got:\n%s\n  wanted:\n%s\n' "$got" "$want"
	exit 1
fi

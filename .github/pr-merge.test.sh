#!/usr/bin/env bash
# The body is what fails silently: a merge with no link is still a merge.
set -euo pipefail
t="$(cd "$(dirname "$0")" && pwd)/pr-merge.sh"
u=https://github.com/landsman/homelab/pull/7
fail=0
check() {
  local got
  got=$("$t" body "$2" "$u")
  [[ $got == "$1" ]] || { echo "want: $1"; echo " got: $got"; fail=1; }
}

check $'Fixes the thing.\n\nReviewed-on: '"$u" "Fixes the thing."
check $'line one\nline two\n\nReviewed-on: '"$u" $'line one\r\nline two\r\n'
check "Reviewed-on: $u" ""
check "Reviewed-on: $u" $'  \n'

exit $fail

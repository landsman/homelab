#!/usr/bin/env bash
# The title is the one thing here that fails silently: a wrong one is still a title.
set -euo pipefail
t="$(cd "$(dirname "$0")" && pwd)/dependabot-title.sh"
fail=0
check() {
  local got
  got=$("$t" "${@:2}")
  [[ $got == "$1" ]] || { echo "want: $1"; echo " got: $got"; fail=1; }
}

check "deps(insuit): bump astro from 5.1.0 to 5.2.0" \
  "deps(insuit): bump astro from 5.1.0 to 5.2.0 in /insuit" "astro" "5.1.0" "5.2.0"
check "deps(pollos): bump astro and wrangler" \
  "deps(pollos): bump the all group in /pollos/microsite-ws with 2 updates" "astro, wrangler"
check "deps(pollos): bump astro, wrangler and @types/node" \
  "deps(pollos): bump the all group across 1 directory with 3 updates" "astro, wrangler, @types/node" "1" "2"
check "deps(dashboard): bump a, b, c and 2 more" \
  "deps(dashboard): bump the all group with 5 updates" "a,b,c,d,e"
check "deps: bump actions/checkout" "Bump actions/checkout" "actions/checkout"

exit $fail

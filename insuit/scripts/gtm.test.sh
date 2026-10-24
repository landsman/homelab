#!/usr/bin/env bash
# A plan with changes is not a failed plan, and a failed one is not "no changes".
set -euo pipefail
cd "$(dirname "$0")"

check() {
  local code=$1 want=$2 got
  got=$(./gtm.sh changed "$code") || got=fail
  [ "$got" = "$want" ] || { echo "FAIL  exit $code: want $want, got $got" >&2; exit 1; }
}

check 0 false
check 2 true
check 1 fail
check 127 fail
echo "ok    gtm"

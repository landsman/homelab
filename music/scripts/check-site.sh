#!/usr/bin/env bash
# Waits until a deployed site serves this build, then exits 0; fails after a
# few minutes. "This build" is the hashed entry script in the local index.html:
# a page that answers 200 with another build's hash — or a fresh pages.dev
# alias still without its certificate — is not done yet.
#
#   check-site.sh <url> <dist/index.html>
#   check-site.sh entry <index.html>   prints the entry script's path
set -euo pipefail

entry() { grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$1" | head -1; }

check() {
  local url=$1 want got i
  want=$(entry "$2")
  [ -n "$want" ] || { echo "no entry script in $2" >&2; exit 1; }
  for i in $(seq 1 30); do
    got=$(curl -fsS --max-time 10 "$url" 2>/dev/null || true)
    if grep -qF "$want" <<<"$got"; then echo "ok    $url serves $want"; return; fi
    echo "wait  $url ($i/30)"
    sleep 10
  done
  echo "fail  $url never served $want" >&2
  exit 1
}

case ${1:-} in
  entry) entry "$2" ;;
  http*) check "$@" ;;
  *) sed -n '2,9p' "$0" >&2; exit 2 ;;
esac

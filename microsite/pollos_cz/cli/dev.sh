#!/usr/bin/env bash
# Local dev server: serve public/ over HTTP and rebuild on source changes.
# Watches src/, templates/, cli/, Makefile.
set -eu
cd "$(dirname "$0")/.."

WATCH_DIRS=(src templates cli Makefile)
PORT="${PORT:-4321}"

make build

# `wrangler pages dev` emulates Cloudflare Pages locally — reads _headers,
# _redirects, and Functions exactly like production.
# `exec` so $! is wrangler's PID, not the subshell's (clean shutdown).
(exec mise exec -- wrangler pages dev public --port "${PORT}" --ip 127.0.0.1 --compatibility-date=2025-12-01) &
SERVER_PID=$!

cleanup() {
  trap - EXIT INT TERM
  kill "${SERVER_PID}" 2>/dev/null || true
  pkill -P $$ 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

echo
echo "serving  http://localhost:${PORT}/"
echo "watching ${WATCH_DIRS[*]}"
echo "Ctrl-C to stop"
echo

if command -v fswatch >/dev/null 2>&1; then
  fswatch -o "${WATCH_DIRS[@]}" | while read -r _; do
    echo "[rebuild]"
    make build || true
  done
elif command -v entr >/dev/null 2>&1; then
  find "${WATCH_DIRS[@]}" -type f | entr -d -s 'echo "[rebuild]"; make build || true'
else
  echo "WARN: install fswatch (brew install fswatch) or entr for auto-rebuild."
  wait "${SERVER_PID}"
fi
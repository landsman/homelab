#!/bin/sh
# Substitute BASE_PATH into index.html once at container start. Runs from
# nginx:alpine's /docker-entrypoint.d/ hook before nginx itself boots.
# Default '/' is a no-op; override e.g. BASE_PATH=/welcome-page/ in compose.
set -eu

: "${BASE_PATH:=/}"
: "${INDEX:=/usr/share/nginx/html/index.html}"

# Escape sed delimiter '|' and '&' (special in replacement)
ESCAPED=$(printf '%s\n' "$BASE_PATH" | sed 's/[|&]/\\&/g')

# Portable in-place edit (BSD vs GNU sed differ on `-i` syntax).
TMP="${INDEX}.tmp"
sed "s|window.__BASE_PATH__ = '/';|window.__BASE_PATH__ = '${ESCAPED}';|" "$INDEX" > "$TMP"
mv "$TMP" "$INDEX"

echo "base-path: rewrote window.__BASE_PATH__ → '${BASE_PATH}'"

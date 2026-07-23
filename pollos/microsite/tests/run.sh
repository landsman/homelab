#!/bin/sh
# Runs every *.test.sh in this directory and reports the total failure count.
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
FAILED=0

for t in "$SCRIPT_DIR"/*.test.sh; do
    [ -e "$t" ] || continue
    echo "▶ $(basename "$t")"
    if ! sh "$t"; then
        FAILED=$((FAILED + 1))
    fi
    echo
done

[ "$FAILED" -eq 0 ]

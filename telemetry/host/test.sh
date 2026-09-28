#!/bin/sh
set -eu

# The one decision in host/ that fails silently: editing cmdline.txt. Runs the
# real function on a copy, needs no root.

dir="$(dirname "$0")"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

printf 'console=serial0,115200 root=PARTUUID=abc rootwait\n' > "$tmp"
sh "$dir/docker-host.sh" cmdline "$tmp" | grep -qx changed
[ "$(sh "$dir/docker-host.sh" cmdline "$tmp")" = "" ] || { echo "FAIL: second run changed it again"; exit 1; }
[ "$(wc -l < "$tmp")" -eq 1 ] || { echo "FAIL: no longer one line"; exit 1; }
[ "$(grep -o 'cgroup_enable=memory' "$tmp" | wc -l)" -eq 1 ] || { echo "FAIL: not exactly once"; exit 1; }
grep -q '^console=serial0,115200 root=PARTUUID=abc rootwait cgroup_enable=memory$' "$tmp" || { echo "FAIL: $(cat "$tmp")"; exit 1; }

printf 'one\ntwo\n' > "$tmp"
if sh "$dir/docker-host.sh" cmdline "$tmp" >/dev/null 2>&1; then echo "FAIL: edited a two-line file"; exit 1; fi

echo "ok"

#!/usr/bin/env bash
# Tests 007-registry-mirror.sh without root, Docker or systemd: `systemctl` and `docker` are stubs
# on PATH that record how they were called, and daemon.json is a file in a throwaway directory.
#
# What is worth testing is what goes wrong silently on a real box: another key in daemon.json lost
# on the way, a reload on every re-run, `off` leaving an empty file behind, and a daemon.json that
# does not parse being overwritten instead of refused.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/007-registry-mirror.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
mkdir -p "$t/bin"
export PATH="$t/bin:$PATH" CALLS="$t/calls" DAEMON_JSON="$t/docker/daemon.json"
for stub in systemctl docker; do
	cat >"$t/bin/$stub" <<STUB
#!/bin/sh
echo "$stub \$*" >>"\$CALLS"
STUB
	chmod +x "$t/bin/$stub"
done

fail=0
check() { # check <behaviour> <command…>
	local what=$1
	shift
	if "$@"; then echo "ok   $what"; else echo "FAIL $what"; fail=1; fi
}
run() { # run <MIRROR or -> ; `-` leaves MIRROR unset. The script's exit code lands in $rc.
	: >"$CALLS"
	rc=0
	if [ "$1" = - ]; then
		env -u MIRROR sh "$script" >/dev/null 2>&1 || rc=$?
	else
		MIRROR=$1 sh "$script" >/dev/null 2>&1 || rc=$?
	fi
}
mirrors() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("registry-mirrors"))' "$DAEMON_JSON"; }
key() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2]))' "$DAEMON_JSON" "$1"; }
reloads() { grep -c '^systemctl reload docker$' "$CALLS" || true; }

url=https://nas.example.ts.net:5000

run "$url"
check "it succeeds on a box without daemon.json" test "$rc" = 0
check "a box without daemon.json gets one naming the mirror" test "$(mirrors)" = "['$url']"
check "and dockerd is reloaded" test "$(reloads)" = 1

printf '{"log-driver": "local"}\n' >"$DAEMON_JSON"
run "$url"
check "a key already in daemon.json is kept" test "$(key log-driver)" = local
check "next to the mirror" test "$(mirrors)" = "['$url']"

run "$url"
check "a re-run with the same mirror does not reload dockerd" test "$(reloads)" = 0

run off
check "off removes the mirror" test "$(mirrors)" = None
check "and keeps the other key" test "$(key log-driver)" = local
check "and reloads dockerd" test "$(reloads)" = 1

rm -f "$DAEMON_JSON"
run off
check "off on a box without daemon.json writes no file" test ! -e "$DAEMON_JSON"
check "and does not reload dockerd" test "$(reloads)" = 0

printf '{"log-driver": "local",\n' >"$DAEMON_JSON"
run "$url"
check "a daemon.json that does not parse is refused" test "$rc" != 0
check "and left as it was" test "$(cat "$DAEMON_JSON")" = '{"log-driver": "local",'
check "and dockerd is not reloaded" test "$(reloads)" = 0

rm -f "$DAEMON_JSON"
run http://nas.example.ts.net:5000
check "a mirror that is not https is refused" test "$rc" != 0
check "and nothing is written" test ! -e "$DAEMON_JSON"
run -
check "MIRROR unset is refused" test "$rc" != 0

exit "$fail"

#!/usr/bin/env bash
# Tests 007-registry-mirror.sh without root, Docker or systemd: `systemctl` and `docker` are stubs
# on PATH that record how they were called, and daemon.json is a file in a throwaway directory.
#
# What is worth testing is what goes wrong silently on a real box: a daemon.json dockerd cannot
# parse, a reload on every re-run, and `off` that leaves the mirror in or writes a file nobody asked for.
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
# What dockerd would read: the file parsed as JSON, so a quoting slip fails here as it would there.
config() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1])))' "$DAEMON_JSON" 2>/dev/null; }
reloads() { grep -c '^systemctl reload docker$' "$CALLS" || true; }

url=https://nas.example.ts.net:5000
other=https://other.example.ts.net:5000

run "$url"
check "it succeeds on a box without daemon.json" test "$rc" = 0
check "and writes a daemon.json naming the mirror and nothing else" test "$(config)" = "{'registry-mirrors': ['$url']}"
check "and reloads dockerd" test "$(reloads)" = 1

run "$url"
check "a re-run with the same mirror does not reload dockerd" test "$(reloads)" = 0

run "$other"
check "another mirror replaces the first" test "$(config)" = "{'registry-mirrors': ['$other']}"
check "and reloads dockerd" test "$(reloads)" = 1

printf '{"log-driver": "local"}\n' >"$DAEMON_JSON"
run "$url"
check "a key added by hand is overwritten, the script owns the file" test "$(config)" = "{'registry-mirrors': ['$url']}"

run off
check "off removes daemon.json" test ! -e "$DAEMON_JSON"
check "and reloads dockerd" test "$(reloads)" = 1

run off
check "off on a box without daemon.json does nothing" test ! -e "$DAEMON_JSON"
check "and does not reload dockerd" test "$(reloads)" = 0

run http://nas.example.ts.net:5000
check "a mirror that is not https is refused" test "$rc" != 0
check "and nothing is written" test ! -e "$DAEMON_JSON"
run -
check "MIRROR unset is refused" test "$rc" != 0

exit "$fail"

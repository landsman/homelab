#!/usr/bin/env bash
# What tailscale-api.sh would get wrong silently: a body printed into the public log on success, or an error
# shown without Tailscale's reason. No network.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/tailscale-api.sh"
fail=0
expect() {
	if [ "$1" = "$2" ]; then echo "ok   $3"; else echo "FAIL $3 — want [$2], got [$1]"; fail=1; fi
}

expect "$(echo '{"vipServices":[{"name":"svc:deploy","addrs":["100.1.2.3"]}]}' | "$script" line 200 vip-services)" \
	"200 vip-services: ok" "a success prints no part of the body"
expect "$(echo '{"message":"not found"}' | "$script" line 404 vip-services/svc:deploy)" \
	"404 vip-services/svc:deploy: not found" "an error shows Tailscale's own message"
expect "$(echo '<html>gateway</html>' | "$script" line 502 services)" \
	"502 services: no message" "an answer that is not JSON still gives a line"
rc=0
"$script" nonsense >/dev/null 2>&1 || rc=$?
expect "$rc" 2 "an unknown command is refused"

exit "$fail"

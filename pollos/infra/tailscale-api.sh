#!/usr/bin/env bash
# What the Tailscale API answers the OAuth client Terraform runs as, for a resource whose apply fails with
# nothing more than "not found (404)". Prints one line per call: the HTTP status, the path, and Tailscale's
# own message on an error. Never a token, and no response body on success, since the run log is public.
#
#   TS_OAUTH_CLIENT_ID=… TS_OAUTH_CLIENT_SECRET=… pollos/infra/tailscale-api.sh check
#   pollos/infra/tailscale-api.sh line <status> <path> < body    # one result line, for the test
set -euo pipefail

api=https://api.tailscale.com/api/v2

# One result line from a status, a path and the response body on stdin.
line() {
	local message
	message=$(jq -r 'if type == "object" then (.message // empty) else empty end' 2>/dev/null || true)
	case "$1" in
	2??) echo "$1 $2: ok" ;;
	*) echo "$1 $2: ${message:-no message}" ;;
	esac
}

check() {
	: "${TS_OAUTH_CLIENT_ID:?set TS_OAUTH_CLIENT_ID}" "${TS_OAUTH_CLIENT_SECRET:?set TS_OAUTH_CLIENT_SECRET}"
	local token body status path
	token=$(curl -fsS "$api/oauth/token" -d "client_id=$TS_OAUTH_CLIENT_ID" -d "client_secret=$TS_OAUTH_CLIENT_SECRET" |
		jq -r .access_token)
	[ -n "$token" ] && [ "$token" != null ] || { echo "no access token for this OAuth client" >&2; exit 1; }
	# In Actions the token is masked, should anything ever print it.
	[ -z "${GITHUB_ACTIONS:-}" ] || echo "::add-mask::$token"
	body=$(mktemp)
	# The policy first, which the same apply writes fine: if it fails too, the client itself is the problem.
	for path in acl vip-services vip-services/svc:deploy services services/svc:deploy; do
		status=$(curl -sS -o "$body" -w '%{http_code}' -H "Authorization: Bearer $token" "$api/tailnet/-/$path")
		line "$status" "$path" <"$body"
	done
	rm -f "$body"
}

case "${1:-}" in
check) check ;;
line) line "$2" "$3" ;;
*)
	echo "usage: $0 check | line <status> <path> < body" >&2
	exit 2
	;;
esac

#!/usr/bin/env bash
# Tests user.sh without Authelia, Forgejo or docker: `docker` is a stub on PATH that records
# its calls and answers with the output the real containers give.
#
# What is worth testing is what goes wrong silently: a refused integration or a reworded
# answer leaving an empty forgejo_aud behind, the audience written under the wrong user,
# a second subject pinned for a user who has one (their integration rule then names a
# subject their tokens never carry), and a user added twice.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/user.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
mkdir -p "$t/bin"
export PATH="$t/bin:$PATH" CALLS="$t/calls" USERS_FILE="$t/users.yml" FORGEJO_MCP_HOST=mcp.example \
	COMPOSE_FILE="${script%/*}/compose.yml"

# Answers by what was asked; $IDS and $FJ_OUT / $FJ_RC set the identifiers and Forgejo's reply.
cat >"$t/bin/docker" <<'STUB'
#!/bin/sh
echo "docker $*" >>"$CALLS"
case "$*" in
*"crypto hash"*) cat >/dev/null; echo 'Digest: $argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA' ;;
*"identifiers export"*) printf '%s\n' "$IDS" ;;
*create-authorized-integration*) printf '%s\n' "$FJ_OUT"; exit "${FJ_RC:-0}" ;;
esac
STUB
chmod +x "$t/bin/docker"

fail=0
check() { # check <what it is> <command…>
	local what=$1
	shift
	if "$@"; then echo "ok   $what"; else
		echo "FAIL $what"
		fail=1
	fi
}
aud() { awk -v u="  $1:" '$0 == u { f = 1; next } /^  [^ ]/ { f = 0 } f && /forgejo_aud/ { print $2 }' "$USERS_FILE"; }

ids_for() { # ids_for <username> <uuid>
	printf 'identifiers:\n    - service: openid\n      sector_id: ""\n      username: %s\n      identifier: %s\n' "$1" "$2"
}
fj_ok='{
  "message": "Authorized integration was successfully created.",
  "name": "forgejo-mcp",
  "issuer": "https://mcp.example/issuer",
  "audience": "u:7:1111",
  "claim_rules": []
}'

: >"$CALLS"
echo 'pw' | sh "$script" login alice a@example.org >/dev/null
echo 'pw' | sh "$script" login bob b@example.org >/dev/null
check "login adds a user with a hash and an empty forgejo_aud" \
	grep -q "password: '\$argon2id" "$USERS_FILE"
out=$(echo 'pw' | sh "$script" login alice a@example.org)
check "login leaves a user who is already there alone" \
	test "$(grep -c '^  alice:$' "$USERS_FILE")" = 1 -a "$out" = "alice is in $USERS_FILE"
check "login hashes with the image compose.yml runs" grep -q 'docker run --rm -i ghcr.io/authelia/authelia:' "$CALLS"
ln "$USERS_FILE" "$t/mounted.yml" # what the container sees: the same inode
check "login refuses an empty password" sh -c "! printf '' | sh '$script' login carol c@example.org 2>/dev/null"

export IDS FJ_OUT FJ_RC
IDS=$(ids_for bob 2222) FJ_OUT=$fj_ok
: >"$CALLS"
check "integration succeeds for a user with a subject" sh -c "sh '$script' integration bob >/dev/null 2>&1"
check "integration writes the audience under that user" test "$(aud bob)" = "'u:7:1111'"
check "integration rewrites users.yml in place, so the mounted file sees it" \
	grep -q "u:7:1111" "$t/mounted.yml"
check "integration leaves the other users' forgejo_aud empty" test "$(aud alice)" = "''"
check "integration ties the rule to the subject already pinned" grep -q -- '--claim-eq sub=2222' "$CALLS"
check "integration does not pin a second subject" sh -c "! grep -q 'identifiers add' '$CALLS'"

IDS=$(ids_for alice 3333) FJ_OUT='Command error: invalid issuer' FJ_RC=1
check "integration fails when Forgejo refuses it" sh -c "! sh '$script' integration alice 2>/dev/null"
check "a refused integration leaves forgejo_aud empty" test "$(aud alice)" = "''"

FJ_OUT='{ "audience_v2": "x" }' FJ_RC=0
check "integration fails when the answer has no audience" sh -c "! sh '$script' integration alice 2>/dev/null"

exit "$fail"

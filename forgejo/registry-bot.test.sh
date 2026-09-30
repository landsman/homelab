#!/usr/bin/env bash
# Tests registry-bot.sh without Forgejo, docker or the network: `docker` and `curl` are stubs on
# PATH that record how they were called and answer with the output the real ones give.
#
# What is worth testing here is the four decisions that are silent when they go wrong: refusing to
# run without the names, telling an account that exists from one that does not, digging a token out
# of the CLI's sentence, and finding a team's id in the API's JSON.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/registry-bot.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
export PATH="$t/bin:$PATH"
mkdir -p "$t/bin"

# The stubs write every call to $t/calls, and read what to answer from $t/docker.out / $t/curl.out.
cat >"$t/bin/docker" <<'STUB'
#!/bin/sh
echo "docker $*" >>"$CALLS"
cat "$DOCKER_OUT" 2>/dev/null
STUB
cat >"$t/bin/curl" <<'STUB'
#!/bin/sh
echo "curl $*" >>"$CALLS"
cat "$CURL_OUT" 2>/dev/null
STUB
chmod +x "$t/bin/docker" "$t/bin/curl"
export CALLS="$t/calls" DOCKER_OUT="$t/docker.out" CURL_OUT="$t/curl.out"

fail=0
run() { # run <expected exit> <what it is> -- env… -- args…
	local want=$1 what=$2 out rc=0
	shift 2
	: >"$CALLS"
	out=$(env "${@:1:$#}" sh "$script" "${ARGS[@]}" 2>&1) || rc=$?
	LAST_OUT=$out
	if [ "$rc" != "$want" ]; then
		echo "FAIL $what: exit $rc, wanted $want"
		echo "     $out"
		fail=1
	else
		echo "ok   $what"
	fi
}
says() { # says <substring> <what it is>
	case "$LAST_OUT" in
	*"$1"*) echo "ok   $2" ;;
	*)
		echo "FAIL $2: output was: $LAST_OUT"
		fail=1
		;;
	esac
}
called() { # called <substring> <what it is>
	if grep -qF -- "$1" "$CALLS"; then echo "ok   $2"; else
		echo "FAIL $2: calls were:"
		sed 's/^/     /' "$CALLS"
		fail=1
	fi
}
not_called() { # not_called <substring> <what it is>
	if grep -qF -- "$1" "$CALLS"; then
		echo "FAIL $2: it was called"
		fail=1
	else echo "ok   $2"; fi
}

# The names have no defaults, because this repository is public.
ARGS=(account)
run 1 "account without ORG" ORG= BOT_USER=b
says "set ORG" "and it names ORG"
run 1 "account without BOT_USER" ORG=o BOT_USER=
says "set BOT_USER" "and it names BOT_USER"

ARGS=(nonsense)
run 2 "an unknown subcommand" ORG=o BOT_USER=b
says "usage:" "and prints usage"

ARGS=(token deploy)
run 2 "a token scope that is neither read nor write" BOT_USER=b ORG=o
says "read or write" "and says which scopes exist"

# An account that is already there is left alone — the whole point of running this twice.
printf '1 other-bot other@example.com\n2 acme-bot acme@example.com\n' >"$DOCKER_OUT"
ARGS=(account)
run 0 "account when it exists" ORG=o BOT_USER=acme-bot
says "acme-bot exists" "and says so"
not_called "user create" "and creates nothing"

# A name that only looks like the one asked for must not count as found.
printf '1 acme-bot-old acme@example.com\n' >"$DOCKER_OUT"
run 0 "account when only a similar name exists" ORG=o BOT_USER=acme-bot
called "user create" "and creates the account"
called "--username 'acme-bot'" "with the name it was given"

# The CLI prints a sentence; the caller wants the token and nothing else, to pipe it.
printf 'Access token was successfully created: 0123456789abcdef\n' >"$DOCKER_OUT"
ARGS=(token read)
run 0 "token read" BOT_USER=acme-bot ORG=o
if [ "$LAST_OUT" = "0123456789abcdef" ]; then
	echo "ok   and prints the token alone"
else
	echo "FAIL token read printed: $LAST_OUT"
	fail=1
fi
called "--scopes read:package" "with the scope asked for"

# The team: found by name in a list that has several, and the member added to the id found.
printf '[{"id":3,"name":"Owners"},{"id":7,"name":"packages"}]\n' >"$CURL_OUT"
ARGS=(team)
run 0 "team when it exists" ORG=o BOT_USER=acme-bot FORGEJO_TOKEN=tok
says "team packages exists (7)" "and reports its id"
called "/teams/7/members/acme-bot" "and adds the member to that team"
not_called "-d {" "and creates no second team"

echo
if [ "$fail" = 0 ]; then
	echo "registry-bot.sh: all cases pass"
else
	echo "registry-bot.sh: FAILURES"
fi
exit "$fail"

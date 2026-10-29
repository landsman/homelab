#!/usr/bin/env sh
#
# A person who may use forgejo-mcp: their Authelia login, and the Forgejo Authorized
# Integration that lets forgejo-mcp act as them. Run on the Pi, in this folder.
#
#     op read op://<vault>/<item>/password | ./user.sh login <username> <email>
#                                  add the user to users.yml, password from stdin
#     ./user.sh integration <username>
#                                  create their integration in Forgejo, write its audience
#                                  into users.yml as forgejo_aud
#
# The two are separate because of the order things start in: Authelia needs the user to
# exist, forgejo-mcp needs Authelia to answer, and Forgejo refuses an integration whose
# issuer (forgejo-mcp) does not answer yet.
#
# The integration's rule `sub = <the user's Authelia subject>` is what ties the two: without
# it, anyone whose token carried this audience would act as this user. The subject is
# pinned in Authelia's database before the first login, so the rule can name it.
#
# Both are idempotent: a user already in users.yml, or one with a forgejo_aud, is left alone.
set -eu

users=${USERS_FILE:-users.yml}
compose=${COMPOSE_FILE:-compose.yml}
scopes=${SCOPES:-read:user,write:repository,write:issue}

# `cat >` rather than an editor: users.yml holds password hashes, so it stays 0600.
login() {
	user=$1 email=$2
	if grep -q "^  $user:\$" "$users" 2>/dev/null; then
		echo "$user is in $users"
		return 0
	fi
	pw=$(cat)
	[ -n "$pw" ] || {
		echo "no password on stdin" >&2
		exit 1
	}
	# A throwaway container of the image compose.yml runs, since Authelia itself will not
	# start before users.yml exists. The password reaches it on stdin, not in argv.
	image=$(sed -n 's/^ *image: \(.*authelia\/authelia:.*\)$/\1/p' "$compose")
	hash=$(printf '%s' "$pw" | docker run --rm -i "${image:?no authelia image in $compose}" sh -c \
		'authelia crypto hash generate argon2 --password "$(cat)"' | sed -n 's/^Digest: //p')
	[ -n "$hash" ] || {
		echo "no digest from authelia crypto hash" >&2
		exit 1
	}
	umask 077
	[ -s "$users" ] || echo 'users:' >"$users"
	cat >>"$users" <<EOF
  $user:
    displayname: '$user'
    email: '$email'
    password: '$hash'
    extra:
      forgejo_aud: ''
EOF
	echo "added $user"
}

integration() {
	user=$1
	host=${FORGEJO_MCP_HOST:?set FORGEJO_MCP_HOST, see .env.example}
	grep -q "^  $user:\$" "$users" 2>/dev/null || {
		echo "$user is not in $users — run login first" >&2
		exit 1
	}
	if [ -n "$(aud_of "$user")" ]; then
		echo "$user has a forgejo_aud"
		return 0
	fi

	sub=$(subject "$user")
	# Not a pipeline: `forgejo … | sed` exits with sed's status, so a refused integration
	# would write an empty audience and report success.
	set -- --username "$user" --name forgejo-mcp --issuer "https://$host/issuer" --claim-eq "sub=$sub"
	for s in $(echo "$scopes" | tr ',' ' '); do set -- "$@" --scope "$s"; done
	out=$(docker exec -u git forgejo forgejo admin user create-authorized-integration "$@" 2>&1) || {
		echo "$out" >&2
		exit 1
	}
	aud=$(printf '%s\n' "$out" | sed -n 's/^ *"audience": "\(.*\)",\{0,1\}$/\1/p')
	[ -n "$aud" ] || {
		echo "no audience in Forgejo's answer — did its output change?" >&2
		echo "$out" >&2
		exit 1
	}
	set_aud "$user" "$aud"
	echo "$user: integration created, forgejo_aud written (sub $sub)"
}

# The user's opaque subject, the `sub` of their tokens. Pinned now if they have none yet,
# so it is known before the first login.
subject() {
	sub=$(subject_of "$1")
	if [ -z "$sub" ]; then
		docker exec authelia authelia storage user identifiers add "$1" >/dev/null
		sub=$(subject_of "$1")
	fi
	[ -n "$sub" ] || {
		echo "no openid subject for $1 in Authelia's database" >&2
		exit 1
	}
	echo "$sub"
}

subject_of() {
	# One entry per `- `, its fields in any order: decide when the entry ends.
	docker exec authelia sh -c \
		'authelia storage user identifiers export --file /tmp/ids.yml >/dev/null && cat /tmp/ids.yml && rm /tmp/ids.yml' |
		awk -v u="$1" '
		function done() { if (n == u && svc == "openid" && id != "") print id; n = svc = id = "" }
		/^ *- /         { done() }
		{ v = $NF; gsub(/["'\'']/, "", v) }
		/identifier:/   { id = v }
		/service:/      { svc = v }
		/username:/     { n = v }
		END             { done() }' | head -1
}

aud_of() {
	awk -v u="  $1:" '$0 == u { in_u = 1; next } /^  [^ ]/ { in_u = 0 }
		in_u && /forgejo_aud:/ { v = $2; gsub(/'\''/, "", v); print v }' "$users"
}

set_aud() {
	tmp="$users.new"
	umask 077
	awk -v u="  $1:" -v a="$2" '$0 == u { in_u = 1 } /^  [^ ]/ && $0 != u { in_u = 0 }
		in_u && /forgejo_aud:/ { sub(/forgejo_aud:.*/, "forgejo_aud: '\''" a "'\''") } { print }' \
		"$users" >"$tmp"
	# Rewritten in place, not moved over: the container mounts this one file, and a mount
	# of a file keeps the inode it started with, so a rename would never reach Authelia.
	cat "$tmp" >"$users"
	rm "$tmp"
}

case "${1:-}" in
login) login "${2:?usage: user.sh login <username> <email>}" "${3:?usage: user.sh login <username> <email>}" ;;
integration) integration "${2:?usage: user.sh integration <username>}" ;;
*)
	echo "usage: $0 login <username> <email> | integration <username>" >&2
	exit 2
	;;
esac

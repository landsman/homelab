#!/usr/bin/env sh
#
# The account that pushes and pulls container images, and the team that lets it.
#
#     ./registry-bot.sh account                 create the account if it is missing
#     FORGEJO_TOKEN=… ./registry-bot.sh team    create the team and put the account in it
#     ./registry-bot.sh token read|write        print a token — pipe it, never paste it
#
# Run it on the Pi: the account and the tokens go through Forgejo's own CLI inside the container,
# which is the only way to make them without a password. The team needs the API, and a token with
# `write:organization` — a personal one, from Settings → Applications, passed for that one call.
#
# Why an account rather than a person's token: Forgejo has no token scoped to one package or one
# repository, so what limits a leaked token is the reach of the account behind it. This one is in
# no organisation but `$ORG`, and its password is random and known to nobody — it exists to hold
# tokens. Images belong to the organisation, not to it: package visibility follows the owner, and a
# user account is public, which would publish every image it owns.
#
# Everything here is idempotent, so it is also the answer to "what was set up on this box".
set -eu

org=${ORG:-trisbee}
bot=${BOT_USER:-trisbee-bot}
team=${TEAM:-packages}
api=${FORGEJO_URL:-https://git.insuit.cz}/api/v1
container=${FORGEJO_CONTAINER:-forgejo}

# `-u git`: the entrypoint drops to that user and the CLI refuses to run as root.
fj() { docker exec -u git "$container" forgejo "$@"; }

account() {
	if fj admin user list 2>/dev/null | awk '{print $2}' | grep -qx "$bot"; then
		echo "$bot exists"
		return 0
	fi
	# The password is made inside the container and never printed: nothing signs in as this account,
	# and an admin can reset it if that ever changes.
	docker exec -u git "$container" sh -c \
		"forgejo admin user create --username '$bot' --email '$bot@noreply.git.insuit.cz' \
		 --password \"\$(head -c 24 /dev/urandom | base64 | tr -d =)\" --must-change-password=false" \
		>/dev/null
	echo "created $bot"
}

team_() {
	token=${FORGEJO_TOKEN:?set FORGEJO_TOKEN to a token with write:organization — see the header}
	id=$(curl -fsS -H "Authorization: token $token" "$api/orgs/$org/teams" |
		sed -n 's/.*"id":\([0-9]*\),"name":"'"$team"'".*/\1/p' | head -1)
	if [ -z "$id" ]; then
		id=$(curl -fsS -X POST -H "Authorization: token $token" -H 'Content-Type: application/json' \
			-d "{\"name\":\"$team\",\"description\":\"Bot accounts that push and pull container images\",
			     \"permission\":\"write\",\"units\":[\"repo.packages\"],\"includes_all_repositories\":false,
			     \"can_create_org_repo\":false}" \
			"$api/orgs/$org/teams" | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)
		echo "created team $team ($id)"
	else
		echo "team $team exists ($id)"
	fi
	curl -fsS -X PUT -H "Authorization: token $token" "$api/teams/$id/members/$bot" >/dev/null
	echo "$bot is in $team"
}

token() {
	scope=${1:?usage: registry-bot.sh token read|write}
	case "$scope" in
	read | write) ;;
	*)
		echo "scope is read or write" >&2
		exit 2
		;;
	esac
	# A name per scope, so a second run is visibly a second token rather than a silent duplicate.
	fj admin user generate-access-token --username "$bot" \
		--token-name "registry-$scope" --scopes "$scope:package" |
		sed -n 's/.*Access token was successfully created: //p'
}

case "${1:-}" in
account) account ;;
team) team_ ;;
token) token "${2:-}" ;;
*)
	echo "usage: $0 account|team|token read|write" >&2
	exit 2
	;;
esac

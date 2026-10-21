#!/usr/bin/env sh
#
# Squash by default, and no merge commits, on every repository of the instance.
#
#     FORGEJO_TOKEN=… ./merge-style.sh apply   change every repository that is not set up yet
#     ./merge-style.sh pick < repos.json       which of these repositories `apply` would change
#
# compose.yml sets DEFAULT_MERGE_STYLE for the instance, but Forgejo reads it only when a repository
# is created — and has no setting at all for which merge styles a new one allows. So this is what
# brings an existing repository, or one created with the defaults, in line. Run it again after
# creating repositories; it changes only the ones that are not set up yet.
#
# The token is a site admin's, scope `read:repository,write:repository`: a search with anyone
# else's sees only their own repositories, and the run then reports success over a fraction of them.
# It runs from anywhere that reaches the API, laptop included, and needs jq.
#
# Rebase and fast-forward stay allowed: neither makes a merge commit. "Rebase then create merge
# commit" does, so it goes.
set -eu

api=${FORGEJO_URL:-https://git.insuit.cz}/api/v1

# Archived ones refuse the edit, mirrors take no pull requests, and one with pull requests switched
# off has no merge style to set.
pick() {
	jq -r '.[]
		| select(.archived | not) | select(.mirror | not) | select(.has_pull_requests)
		| select(.allow_merge_commits or .allow_rebase_explicit or (.allow_squash_merge | not)
			or .default_merge_style != "squash")
		| .full_name'
}

apply() {
	token=${FORGEJO_TOKEN:?set FORGEJO_TOKEN to a site admin token — see the header}
	page=1 seen=0
	while :; do
		repos=$(curl -fsS -H "Authorization: token $token" "$api/repos/search?limit=50&page=$page" | jq '.data')
		n=$(printf '%s' "$repos" | jq length)
		[ "$n" -gt 0 ] || break
		seen=$((seen + n))
		for repo in $(printf '%s' "$repos" | pick); do
			curl -fsS -X PATCH -H "Authorization: token $token" -H 'Content-Type: application/json' \
				-d '{"allow_merge_commits":false,"allow_rebase_explicit":false,
				     "allow_squash_merge":true,"default_merge_style":"squash"}' \
				"$api/repos/$repo" >/dev/null
			echo "set $repo"
		done
		page=$((page + 1))
	done
	echo "$seen repositories seen"
}

case "${1:-}" in
pick) pick ;;
apply) apply ;;
*)
	echo "usage: $0 apply|pick" >&2
	exit 2
	;;
esac

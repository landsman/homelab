#!/usr/bin/env bash
# Posts the preview link on a PR as a new comment, after hiding the earlier
# ones as outdated, so the newest link is always the one at the bottom.
#
#   preview-comment.sh post <owner/repo> <pr> <url> <commit>   needs GH_TOKEN
#   preview-comment.sh stale < comments.json   node ids of the comments to hide
#
# PREVIEW_MARKER names the site, so a PR that previews two sites (music uses
# this too) keeps one live link for each rather than hiding the other's.
set -euo pipefail

marker=${PREVIEW_MARKER:-"insuit.cz preview:"}

# Earlier preview comments by the bot that are not hidden yet.
stale() {
  jq -r --arg m "$marker" '.[]
    | select(.user.login == "github-actions[bot]")
    | select(.body | startswith($m))
    | .node_id'
}

post() {
  local repo=$1 pr=$2 url=$3 commit=$4 id
  # Hidden comments come back too; minimizing one twice is harmless.
  gh api --paginate "repos/$repo/issues/$pr/comments" | jq -s add | stale |
    while read -r id; do
      # shellcheck disable=SC2016 # $id is a GraphQL variable, not a shell one
      gh api graphql -f id="$id" \
        -f query='mutation($id: ID!) { minimizeComment(input: {subjectId: $id, classifier: OUTDATED}) { clientMutationId } }' >/dev/null
    done
  gh pr comment "$pr" --repo "$repo" --body "$marker $url (commit $commit)"
}

case ${1:-} in
  stale) stale ;;
  post) shift; post "$@" ;;
  *) sed -n '2,6p' "$0" >&2; exit 2 ;;
esac

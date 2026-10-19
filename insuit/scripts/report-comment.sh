#!/usr/bin/env bash
# Links a failed Cucumber run's published report on its PR.
#
#   report-comment.sh url < bdd.log                           the report's link, or nothing
#   report-comment.sh post <owner/repo> <pr> <url> <commit>   needs GH_TOKEN
set -euo pipefail

# cucumber-js prints the link inside a box drawn around it, after the run. The
# last one wins; a run that published nothing prints nothing and still exits 0.
url() {
  grep -oE 'https://reports\.cucumber\.io/reports/[0-9a-f-]+' | tail -n 1 || true
}

# ponytail: earlier report comments stay visible; hide them as preview-comment.sh does if they pile up.
post() {
  local repo=$1 pr=$2 url=$3 commit=$4
  gh pr comment "$pr" --repo "$repo" \
    --body "Feature tests failed on $commit. Cucumber report, readable for 24 hours: $url"
}

case ${1:-} in
  url) url ;;
  post) shift; post "$@" ;;
  *) sed -n '2,5p' "$0" >&2; exit 2 ;;
esac

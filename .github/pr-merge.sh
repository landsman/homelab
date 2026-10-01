#!/usr/bin/env bash
# Squash-merges a PR with its title as the subject and the PR as a URL at the end of the
# body. GitHub's own squash subject ends in "(#N)", which resolves against whichever forge
# shows the commit, so it points at the wrong PR on a mirror. The same shape as
# .forgejo/default_merge_message/SQUASH_TEMPLATE.md, so history reads alike on both.
#
#   pr-merge.sh <n> [gh pr merge flags, e.g. --auto]
#   pr-merge.sh body <description> <url>   prints the commit body, nothing else
set -euo pipefail

body() {
  local desc=${1//$'\r'/}
  desc=${desc%"${desc##*[![:space:]]}"}
  if [[ -n $desc ]]; then printf '%s\n\nReviewed-on: %s\n' "$desc" "$2"
  else printf 'Reviewed-on: %s\n' "$2"; fi
}

if [[ $1 == body ]]; then body "$2" "$3"; exit; fi

n=$1
title=$(gh pr view "$n" --json title -q .title)
url=$(gh pr view "$n" --json url -q .url)
desc=$(gh pr view "$n" --json body -q .body)
gh pr merge "$n" --squash --delete-branch --subject "$title" --body "$(body "$desc" "$url")" "${@:2}"

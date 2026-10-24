#!/usr/bin/env bash
# What CI does with analytics/analytics.yaml. Run from insuit/, signed in to
# Google.
#
#   gtm.sh plan <file>   the plan as Markdown into <file>, for the PR comment
#   gtm.sh deploy        apply and publish, when the plan has anything to do
#   gtm.sh changed <n>   "true" or "false" for gtm-code plan's exit code n
set -euo pipefail

# gtm-code plan exits 2 when there is something to apply, the way
# `terraform plan -detailed-exitcode` does. Only 1 is a failure.
changed() {
  case $1 in
    0) echo false ;;
    2) echo true ;;
    *) return 1 ;;
  esac
}

plan() {
  local code=0
  bun run gtm:plan --format markdown >"$1" || code=$?
  changed "$code" >/dev/null
}

deploy() {
  local code=0
  bun run gtm:plan || code=$?
  [ "$(changed "$code")" = true ] || return 0
  bun run gtm:apply --auto-approve
  # apply only stages into the workspace; nothing is live until a publish.
  bun run gtm:publish
  # apply records the GA4 resources it creates in .analytics/state.json, the
  # only record that they are ours. Uncommitted, the next run creates them again.
  if [ -n "$(git status --porcelain .analytics)" ]; then
    echo "::error::.analytics/state.json changed: commit it from the gtm-state artifact" >&2
    return 1
  fi
}

"$@"

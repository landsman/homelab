#!/usr/bin/env bash
# Reads a PR's changed paths on stdin and prints "true" when one of them can
# change what the site serves, "false" when the PR only touches what is around
# it: Terraform, the short links, tests, scripts, the Makefile, docs, CI or
# another service. CI uploads a preview only on "true".
#
#   gh pr diff <pr> --name-only | app-changed.sh
set -euo pipefail

around='^insuit/(infra/|links/|tests/|scripts/|[^/]*\.md$|Makefile$|cucumber\.mjs$|playwright\.config\.ts$)'

# Top-level *.md only: insuit/src/features/cv/cv.md is the CV page's source.
# grep -c, not -q: -q stops reading early, and pipefail turns the SIGPIPE
# upstream into a false "false".
n=$(grep '^insuit/' | grep -cvE "$around" || true)
if [ "$n" -gt 0 ]; then echo true; else echo false; fi

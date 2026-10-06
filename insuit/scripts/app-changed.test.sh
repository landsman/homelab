#!/usr/bin/env bash
# A preview is built for a change to the site, and skipped for the rest.
set -euo pipefail
cd "$(dirname "$0")"

check() {
  local want=$1 got
  got=$(printf '%s\n' "${@:2}" | ./app-changed.sh)
  [ "$got" = "$want" ] || { echo "FAIL  want $want, got $got for: ${*:2}" >&2; exit 1; }
}

check true insuit/content/cv/cv.md
check true insuit/content/blog/hello.mdx
check true insuit/messages/en.json
check true insuit/package.json .github/workflows/insuit-ci.yml
check true insuit/infra/main.tf insuit/public/assets/cv/new.jpg
check false insuit/infra/main.tf insuit/Makefile insuit/README.md
check false insuit/scripts/app-changed.sh insuit/tests/e2e/home.spec.ts
check false .github/workflows/insuit-ci.yml dashboard/src/main.tsx
check false ""
echo "ok    app-changed"

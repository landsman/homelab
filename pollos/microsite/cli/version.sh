#!/usr/bin/env bash
set -u

ver() {
  local name="$1"
  local pipeline="$2"
  local v="n/a"
  if command -v "${name}" >/dev/null 2>&1; then
    v="$(eval "${pipeline}" 2>/dev/null || true)"
    v="${v:-n/a}"
  fi
  printf "%-12s %s\n" "${name}" "${v}"
}

ver node       'node --version'
ver python3    "python3 --version | awk '{print \$2}'"
ver shellcheck "shellcheck --version | awk '/^version:/ {print \$2}'"
ver wrangler   "wrangler --version 2>&1 | awk '/wrangler/ {print \$NF; exit}'"
ver rsync      "rsync --version | head -1 | awk '{print \$3}'"
ver fswatch    'fswatch --version | head -1'
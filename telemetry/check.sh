#!/bin/sh
# Parses every config the stack loads, with the image versions compose.yml pins,
# so a typo fails here rather than as a crash loop after `make up` on the Pi.
# usage: ./check.sh   (needs docker and jq; run from anywhere)
set -eu
cd "$(dirname "$0")"

img() { sed -n "s|^ *image: \($1:.*\)|\1|p" compose.yml; }
run() { docker run --rm -v "$PWD:/c:ro" "$@"; }

# grafana's env_file must exist; CI has none, so borrow the example for this run
[ -e .env ] || { cp .env.example .env; trap 'rm -f .env' EXIT; }
GF_SECURITY_ADMIN_USER=x GF_SECURITY_ADMIN_PASSWORD=x XDG_RUNTIME_DIR=/run \
  docker compose config -q
run --entrypoint promtool "$(img prom/prometheus)" check config /c/prometheus/prometheus.yml
run "$(img grafana/loki)" -config.file=/c/loki/loki.yml -verify-config
run "$(img grafana/alloy)" fmt /c/alloy/config.alloy >/dev/null
run "$(img prom/blackbox-exporter)" --config.file=/c/blackbox/blackbox.yml --config.check
for f in grafana/dashboards/*.json; do jq empty "$f" || { echo "invalid JSON: $f"; exit 1; }; done

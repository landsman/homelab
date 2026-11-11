#!/bin/sh
# Validates every config the stack loads, with the image versions compose.yml
# pins, so a typo or a misspelled block fails here rather than as a crash loop
# after `make up` on the Pi.
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
run "$(img grafana/alloy)" validate /c/alloy/config.alloy
# the host's journal shipper, whose config lives in journal.sh
sh host/journal.sh config | run -i "$(img grafana/alloy)" validate /dev/stdin
run "$(img telegraf)" telegraf config check --config /c/telegraf/telegraf.conf
run "$(img prom/blackbox-exporter)" --config.file=/c/blackbox/blackbox.yml --config.check
for f in grafana/dashboards/*.json; do jq empty "$f" || { echo "invalid JSON: $f"; exit 1; }; done

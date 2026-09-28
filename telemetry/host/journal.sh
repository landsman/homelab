#!/bin/sh
set -eu

#
# PURPOSE: ship the Pi's systemd journal — kernel, systemd, disk and USB errors,
# sudo and SSH — into the telemetry stack's Loki, from the host. Grafana Alloy
# runs as a systemd service in the systemd-journal group and pushes to Loki on
# 127.0.0.1:3215, so no container and not the Docker user ever reads the
# journal: a compromised container gains nothing here.
#
# Run on the Pi that runs the stack, as root:
#
#   curl -fsSL https://raw.githubusercontent.com/landsman/homelab/main/telemetry/host/journal.sh | sudo sh
#
# Subcommands, same way with `sudo sh -s <subcommand>`:
#   install    (default) install or update, rewrite the config, restart
#   status     show the unit and how many journal lines it has read and sent
#   uninstall  remove Alloy, the Grafana apt source and everything this added
#
# Safe to re-run. Package files are left alone: the config and its flags come
# in through a drop-in's second EnvironmentFile, which wins over
# /etc/default/alloy, so `apt upgrade` never asks about a changed file.
#

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

KEY=/etc/apt/keyrings/grafana.asc
LIST=/etc/apt/sources.list.d/grafana.list
CONF=/etc/alloy/journal.alloy
ENVF=/etc/alloy/journal.env
DROPIN=/etc/systemd/system/alloy.service.d/telemetry.conf

install() {
  # Grafana's apt repository, as its docs set it up
  # (https://grafana.com/docs/alloy/latest/set-up/install/linux/)
  mkdir -p /etc/apt/keyrings
  curl -fsSL -o "$KEY" https://apt.grafana.com/gpg-full.key
  chmod 644 "$KEY"
  echo "deb [signed-by=$KEY] https://apt.grafana.com stable main" > "$LIST"
  apt-get update
  apt-get install -y alloy

  # both groups, or loki.source.journal starts without error and reads nothing
  # (the loki.source.journal reference says so)
  usermod -aG adm,systemd-journal alloy

  cat > "$CONF" <<'EOF'
// Written by telemetry/host/journal.sh — re-run it rather than editing.
loki.relabel "journal" {
  forward_to = []

  rule {
    source_labels = ["__journal__systemd_unit"]
    target_label  = "unit"
  }

  rule {
    source_labels = ["__journal_priority_keyword"]
    target_label  = "level"
  }
}

loki.source.journal "host" {
  max_age       = "12h"
  labels        = {job = "journal"}
  relabel_rules = loki.relabel.journal.rules
  forward_to    = [loki.write.local.receiver]
}

// the stack's Loki, published on loopback only (telemetry/compose.yml)
loki.write "local" {
  endpoint {
    url = "http://127.0.0.1:3215/loki/api/v1/push"
  }
}
EOF

  cat > "$ENVF" <<EOF
CONFIG_FILE=$CONF
CUSTOM_ARGS=--disable-reporting
EOF

  mkdir -p "$(dirname "$DROPIN")"
  cat > "$DROPIN" <<EOF
[Service]
EnvironmentFile=$ENVF
EOF

  systemctl daemon-reload
  systemctl enable alloy >/dev/null 2>&1
  # restart, not start: the group membership above only reaches a new process
  systemctl restart alloy
  echo "installed; lines appear in Loki within a minute: sudo sh journal.sh status"
}

status() {
  systemctl --no-pager --lines=0 status alloy || true
  metrics="$(curl -fsS http://127.0.0.1:12345/metrics 2>/dev/null || true)"
  [ -n "$metrics" ] || { echo "alloy is not answering on 127.0.0.1:12345"; exit 1; }
  read_lines="$(echo "$metrics" | awk '/^loki_source_journal_target_lines_total/ {s += $NF} END {print s + 0}')"
  sent="$(echo "$metrics" | awk '/^loki_write_sent_entries_total/ {s += $NF} END {print s + 0}')"
  echo "journal lines read: $read_lines, sent to Loki: $sent"
  [ "$read_lines" != 0 ] || { echo "nothing read — is alloy in the systemd-journal group? id alloy"; exit 1; }
}

uninstall() {
  systemctl disable --now alloy 2>/dev/null || true
  apt-get purge -y alloy
  rm -f "$DROPIN" "$ENVF" "$CONF" "$LIST" "$KEY"
  systemctl daemon-reload
  echo "removed"
}

case "${1:-install}" in
  install | status | uninstall) "${1:-install}" ;;
  *) echo "usage: $0 [install|status|uninstall]"; exit 1 ;;
esac

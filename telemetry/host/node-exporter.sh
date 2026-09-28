#!/bin/sh
set -eu

#
# PURPOSE: host metrics for the telemetry stack — CPU, RAM, disks, temperatures,
# network, SMART and NVMe wear — from Debian's prometheus-node-exporter,
# listening only on this host's Tailscale address, port 9100. Prometheus
# scrapes it by MagicDNS name (../prometheus/prometheus.yml, job "node").
#
# Run on every host (the Pi and each pollos box), as root, after Tailscale is up:
#
#   curl -fsSL https://raw.githubusercontent.com/landsman/homelab/main/telemetry/host/node-exporter.sh | sudo sh
#
# Subcommands, same way with `sudo sh -s <subcommand>`:
#   install    (default) install or update, rebind to the current Tailscale address
#   status     show the units and whether metrics are served
#   uninstall  remove the exporter and everything this script added
#
# Safe to re-run. Package files are left alone: the listen address is a socket
# unit and the flags a drop-in, so `apt upgrade` never asks about a changed
# /etc/default file. Extra flags still go in ARGS there.
#

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

UNIT=prometheus-node-exporter
SOCKET=/etc/systemd/system/$UNIT.socket
DROPIN=/etc/systemd/system/$UNIT.service.d/telemetry.conf

ts_ip() {
  tailscale ip -4 2>/dev/null | head -n 1
}

install() {
  ip="$(ts_ip)"
  [ -n "$ip" ] || { echo "no Tailscale IPv4 address — run tailscale up first"; exit 1; }

  # the collectors package adds root timers every 15 min: smartmon for SATA
  # disks, nvme for NVMe wear and temperature, apt for pending updates
  apt-get install -y $UNIT prometheus-node-exporter-collectors smartmontools nvme-cli

  # bound to the Tailscale address only: the metrics are unauthenticated and
  # describe the whole box. FreeBind lets it bind before tailscaled is up.
  cat > "$SOCKET" <<EOF
[Unit]
Description=node-exporter on the Tailscale address

[Socket]
ListenStream=$ip:9100
FreeBind=yes

[Install]
WantedBy=sockets.target
EOF

  mkdir -p "$(dirname "$DROPIN")"
  # Debian excludes /mnt from filesystems, where the Pi mounts its RAID
  cat > "$DROPIN" <<'EOF'
[Unit]
Requires=prometheus-node-exporter.socket
After=prometheus-node-exporter.socket

[Service]
ExecStart=
ExecStart=/usr/bin/prometheus-node-exporter --web.systemd-socket --collector.filesystem.mount-points-exclude=^/(dev|proc|run|sys|var/lib/docker/.+)($$|/) $ARGS
EOF

  systemctl daemon-reload
  # the package started it on 0.0.0.0:9100, which the socket cannot share
  systemctl stop $UNIT.service
  systemctl enable --now $UNIT.socket
  systemctl start $UNIT.service
  status
}

status() {
  systemctl --no-pager --lines=0 status $UNIT.socket $UNIT.service || true
  ip="$(ts_ip)"
  if curl -fsS "http://$ip:9100/metrics" | grep -q '^node_uname_info'; then
    echo "ok: metrics served on $ip:9100"
  else
    echo "not serving on $ip:9100"
    exit 1
  fi
}

uninstall() {
  systemctl disable --now $UNIT.socket 2>/dev/null || true
  rm -f "$SOCKET" "$DROPIN"
  systemctl daemon-reload
  apt-get purge -y $UNIT prometheus-node-exporter-collectors
  echo "removed; smartmontools and nvme-cli stay installed"
}

case "${1:-install}" in
  install | status | uninstall) "${1:-install}" ;;
  *) echo "usage: $0 [install|status|uninstall]"; exit 1 ;;
esac

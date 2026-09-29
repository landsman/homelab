#!/bin/sh
set -eu

#
# PURPOSE: connect a host that ALREADY runs cloudflared for something else to
# its health tunnel, so it serves a public 200 at  https://<node>-health.pollos.cz
# the same way 003-monitoring.sh does for the pollos boxes.
#
# 003-monitoring.sh would uninstall and replace cloudflared.service — on a host
# whose main tunnel runs as that unit, that takes every app it publishes offline.
# This script never touches cloudflared.service, its config, or whatever keeps
# its binary up to date. It adds one separate unit, cloudflared-health.service,
# which runs the binary already on the host against the health tunnel's token.
#
#   - the token lives in /etc/cloudflared-health/token (root, 0600) and reaches
#     cloudflared through --token-file, never through the unit's command line
#     (--token-file needs cloudflared 2025.4.0+; checked below)
#   - the unit runs as a throwaway DynamicUser, and gets the token through
#     systemd's LoadCredential (%d in ExecStart, systemd 251+), so it runs as
#     no real user at all. It can still read what any user can; the sandbox
#     below takes /mnt, /home, other processes and localhost away from it
#   - it points --config at its own file, so cloudflared never falls back to the
#     main tunnel's /etc/cloudflared/config.yml
#   - it does NOT install or update cloudflared. The host's own update mechanism
#     replaces the binary on disk; this unit picks up the new one on its next
#     restart (systemctl restart cloudflared-health, or a reboot).
#
# The tunnel, DNS record, the 200 response, and the BetterStack monitor are all
# created by Terraform in pollos/infra. This host gets ONLY a per-tunnel
# connector token — it can connect that one tunnel and nothing else.
#
# MANUAL STEP: run on nas (the Raspberry Pi), as root. Grab its connector token
# with  make tunnel-tokens  in pollos/infra (the "nas" entry), or from the
# Cloudflare dashboard → Zero Trust → Networks → Tunnels → health-nas.
#
# then on the host (it will prompt for the token — paste it):
#
#   wget https://pollos.cz/health-sidecar.sh
#   sudo sh health-sidecar.sh
#
# Never pass the token as sudo TUNNEL_TOKEN=... on the command line: sudo
# writes the variables it was given into the journal, where it outlives the
# session. The prompt reads it without echo and without logging.
#
# The node name defaults to the short hostname; if the host is called something
# other than its tunnel (health-<node>), pass HEALTH_NODE=nas.
#
# Other subcommands:
#
#   sh health-sidecar.sh version-ok 2026.7.1   # exit 0 if that version has --token-file
#   sudo sh health-sidecar.sh uninstall        # remove this unit and its token, nothing else
#
# Safe to re-run: rewrites the token and the unit, then restarts the unit.
#

UNIT=cloudflared-health
UNIT_FILE="/etc/systemd/system/${UNIT}.service"
CONF_DIR="/etc/${UNIT}"
MIN_VERSION=2025.4.0 # first release with --token-file
NODE="${HEALTH_NODE:-$(hostname -s)}"

# version_ok <version> — true when <version> (YYYY.M.P) is at least MIN_VERSION.
# An unparseable version is a failure, never a pass.
version_ok() {
  printf '%s\n' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || return 1
  lowest="$(printf '%s\n%s\n' "$MIN_VERSION" "$1" | sort -t. -k1,1n -k2,2n -k3,3n | head -n1)"
  [ "$lowest" = "$MIN_VERSION" ]
}

case "${1:-install}" in
  version-ok)
    [ -n "${2:-}" ] || { echo "usage: $0 version-ok <version>"; exit 2; }
    version_ok "$2"
    exit
    ;;
  uninstall)
    [ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
    systemctl disable --now "$UNIT" >/dev/null 2>&1 || true
    rm -f "$UNIT_FILE"
    rm -rf "$CONF_DIR"
    systemctl daemon-reload
    echo "removed ${UNIT}.service and ${CONF_DIR}; cloudflared.service untouched."
    exit 0
    ;;
  install) ;;
  *)
    echo "usage: $0 [install|uninstall|version-ok <version>]"
    exit 2
    ;;
esac

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

# the binary the host already runs; this script never installs one.
# /usr/bin/cloudflared first: it is the one the main cloudflared.service runs,
# so whatever keeps that tunnel current keeps this one current too. sudo's PATH
# searches /usr/local/bin first, where a separate copy may sit and age.
if [ -x /usr/bin/cloudflared ]; then
  BIN=/usr/bin/cloudflared
else
  BIN="$(command -v cloudflared || true)"
fi
[ -n "$BIN" ] || { echo "cloudflared not found — install it first; on a pollos box use 003-monitoring.sh instead"; exit 1; }
VERSION="$("$BIN" --version | awk '{print $3}')"
version_ok "$VERSION" || { echo "cloudflared ${VERSION} at ${BIN} is older than ${MIN_VERSION} (no --token-file) — update it first"; exit 1; }

# token: from $TUNNEL_TOKEN if set, else prompt — but only on a real terminal,
# never when piped (curl | sh), where a prompt would read the script itself.
if [ -z "${TUNNEL_TOKEN:-}" ] && [ -t 0 ]; then
  printf 'Paste the connector token for health-%s (Cloudflare → Zero Trust → Tunnels): ' "$NODE"
  stty -echo 2>/dev/null || true
  read -r TUNNEL_TOKEN || true
  stty echo 2>/dev/null || true
  printf '\n'
fi
[ -n "${TUNNEL_TOKEN:-}" ] || { echo "no token — run interactively, or see the header"; exit 1; }

# token + a config of its own, readable by root only / by the unit
install -d -m 0755 "$CONF_DIR"
( umask 077 && printf '%s\n' "$TUNNEL_TOKEN" > "${CONF_DIR}/token" )
cat > "${CONF_DIR}/config.yml" <<'EOF'
# cloudflared-health.service only — the health tunnel's ingress lives in
# Terraform (pollos/infra/monitoring.tf). This file exists so cloudflared does
# not fall back to the main tunnel's /etc/cloudflared/config.yml.
no-autoupdate: true
# a fixed port outside 20241-20245: without one, whichever connector starts
# first takes 20241 and the main tunnel's metrics move to another port
metrics: 127.0.0.1:20299
EOF
chmod 0644 "${CONF_DIR}/config.yml"

cat > "$UNIT_FILE" <<EOF
# Written by pollos/setup/006-health-sidecar.sh — re-run it rather than editing.
[Unit]
Description=cloudflared health tunnel connector (separate from cloudflared.service)
After=network-online.target cloudflared.service
Wants=network-online.target

[Service]
Type=notify
DynamicUser=yes
LoadCredential=token:${CONF_DIR}/token
ExecStart=${BIN} tunnel --config ${CONF_DIR}/config.yml run --token-file %d/token
# DynamicUser already makes the system read-only; these also hide other
# users' processes and the data under /mnt (the RAID, the apps' env files)
ProtectHome=yes
ProtectProc=invisible
ProcSubset=pid
InaccessiblePaths=-/mnt
# nothing on localhost is its business: Loki and Prometheus listen there with
# no auth, and a leaked pollos token could otherwise point this tunnel at them.
# DNS on the Pi is Tailscale's 100.100.100.100, not a loopback resolver
IPAddressDeny=localhost
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
CapabilityBoundingSet=
PrivateDevices=yes
SystemCallArchitectures=native
SystemCallFilter=@system-service
MemoryDenyWriteExecute=yes
Restart=on-failure
RestartSec=5s
TimeoutStartSec=30

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$UNIT" >/dev/null 2>&1
systemctl restart "$UNIT"

echo
echo "done. ${UNIT}.service connected with cloudflared ${VERSION} — Cloudflare now serves this host's 200."
echo "cloudflared.service was not touched."
echo "verify (after ~10s):  systemctl status ${UNIT} cloudflared"
echo "                      curl -sI https://${NODE}-health.pollos.cz"

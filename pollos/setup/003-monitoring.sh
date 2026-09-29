#!/bin/sh
set -eu

#
# PURPOSE: connect this box to its health tunnel so it serves a public 200
# at  https://<host>.health.pollos.cz  over an outbound-only Cloudflare Tunnel
# (no ports exposed). BetterStack polls that URL and alerts when it stops
# returning 200 — i.e. when the box, its network, or the tunnel goes down.
#
# The tunnel, DNS record, the 200 response, and the BetterStack monitor are all
# created by Terraform in pollos/infra. This box gets ONLY a per-tunnel
# connector token — it can connect that one tunnel and nothing else in the
# Cloudflare account. So all this script does is install cloudflared and run it.
#
# MANUAL STEP: run on every pollos box (gus, mike, walter, jesse), as root,
# after 001-init.sh (needs curl). Grab this box's connector token from the
# Cloudflare dashboard → Zero Trust → Networks → Tunnels → health-<host>
# (or, if you have Terraform: terraform output -json health_tunnel_tokens).
#
# then on the box (it will prompt for the token — paste it):
#
#   wget https://pollos.cz/monitoring.sh
#   sudo sh monitoring.sh
#
# or non-interactively (CI, automation):
#
#   sudo TUNNEL_TOKEN=eyJhIjoi... sh monitoring.sh
#
# Safe to re-run: reinstalls the service with the given token, upgrades cloudflared.
#

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

# token: from $TUNNEL_TOKEN if set, else prompt — but only on a real terminal,
# never when piped (curl | sh), where a prompt would read the script itself.
if [ -z "${TUNNEL_TOKEN:-}" ] && [ -t 0 ]; then
  printf 'Paste the connector token for health-%s (Cloudflare → Zero Trust → Tunnels): ' "$(hostname -s)"
  stty -echo 2>/dev/null || true
  read -r TUNNEL_TOKEN || true
  stty echo 2>/dev/null || true
  printf '\n'
fi
[ -n "${TUNNEL_TOKEN:-}" ] || { echo "no token — run interactively, or pass TUNNEL_TOKEN=... (see header)"; exit 1; }

# install cloudflared (latest .deb, independent of Debian release)
ARCH="$(dpkg --print-architecture)"             # amd64 on the prodesks
TMP_DEB="$(mktemp --suffix=.deb)"
curl -fsSL -o "$TMP_DEB" \
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
apt-get install -y "$TMP_DEB"   # local .deb: apt resolves deps in one step
rm -f "$TMP_DEB"

# The token goes in a root-only file that systemd hands to the unit as a
# credential, never on its command line: `cloudflared service install <token>`
# puts it in ExecStart, readable by any local user in the unit file (0644) and
# in the process list. Same shape as 006-health-sidecar.sh on nas.
CONF_DIR=/etc/cloudflared-health
UNIT_FILE=/etc/systemd/system/cloudflared.service

# a unit from `cloudflared service install` carries the old token in ExecStart
if [ -f "$UNIT_FILE" ] && grep -q -- '--token ' "$UNIT_FILE"; then
  cloudflared service uninstall >/dev/null 2>&1 || true
fi

install -d -m 0700 "$CONF_DIR"
( umask 077 && printf '%s\n' "$TUNNEL_TOKEN" > "${CONF_DIR}/token" )

cat > "$UNIT_FILE" <<'EOF'
# Written by pollos/setup/003-monitoring.sh — re-run it rather than editing.
[Unit]
Description=cloudflared health tunnel connector
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
DynamicUser=yes
LoadCredential=token:/etc/cloudflared-health/token
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel run --token-file %d/token
# DynamicUser already makes the system read-only; these also hide other
# users' processes and whatever is mounted under /mnt
ProtectHome=yes
ProtectProc=invisible
ProcSubset=pid
InaccessiblePaths=-/mnt
Restart=on-failure
RestartSec=5s
TimeoutStartSec=30

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cloudflared >/dev/null 2>&1 || true
systemctl restart cloudflared

echo
echo "done. cloudflared connected — Cloudflare now serves this box's 200."
echo "verify (after ~10s):  systemctl status cloudflared"
echo "                      ps -eo args | grep [c]loudflared   # no token on the command line"
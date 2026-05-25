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
# after 001-init.sh (needs curl). Get this box's token from Terraform:
#
#   terraform output -json health_tunnel_tokens | jq -r .<host>      # in pollos/infra
#
# then on the box:
#
#   curl -fsSL https://pollos.cz/monitoring.sh -o monitoring.sh
#   sudo TUNNEL_TOKEN=eyJhIjoi...   sh monitoring.sh
#
# Safe to re-run: reinstalls the service with the given token, upgrades cloudflared.
#

: "${TUNNEL_TOKEN:?set TUNNEL_TOKEN to this node connector token from pollos/infra — see header}"
[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

# install cloudflared (latest .deb, independent of Debian release)
ARCH="$(dpkg --print-architecture)"             # amd64 on the prodesks
TMP_DEB="$(mktemp --suffix=.deb)"
curl -fsSL -o "$TMP_DEB" \
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
dpkg -i "$TMP_DEB" || apt-get install -f -y
rm -f "$TMP_DEB"

# (re)install the systemd service bound to this tunnel's token
if [ -f /etc/systemd/system/cloudflared.service ]; then
  cloudflared service uninstall >/dev/null 2>&1 || true
fi
cloudflared service install "$TUNNEL_TOKEN"
systemctl enable cloudflared >/dev/null 2>&1 || true

echo
echo "done. cloudflared connected — Cloudflare now serves this box's 200."
echo "verify (after ~10s):  systemctl status cloudflared"
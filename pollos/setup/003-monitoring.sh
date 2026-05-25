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

# (re)install the systemd service bound to this tunnel's token
if [ -f /etc/systemd/system/cloudflared.service ]; then
  cloudflared service uninstall >/dev/null 2>&1 || true
fi
cloudflared service install "$TUNNEL_TOKEN"
systemctl enable cloudflared >/dev/null 2>&1 || true

echo
echo "done. cloudflared connected — Cloudflare now serves this box's 200."
echo "verify (after ~10s):  systemctl status cloudflared"
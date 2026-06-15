#!/bin/sh
set -eu

#
# MANUAL STEP: run on every box at the console, as root, after 001-init.sh.
#
# What it does:
#   - installs Tailscale via the official install script (adds apt repo,
#     installs + enables the tailscaled daemon)
#   - joins the tailnet using a pre-authorized, tagged auth key, so the node
#     comes up already approved — no manual click in the admin console
#   - keeps the box a PLAIN tailnet node: NOT an exit node, NOT a subnet router.
#     The Apple TV stays the exit node; each box is reachable peer-to-peer over
#     its own MagicDNS name, so there is no 192.168.x.x dependency and no
#     subnet routes to maintain.
#
# The node's MagicDNS name = its hostname, so gus/mike/walter/jesse map 1:1.
# On the home LAN Tailscale connects directly (full LAN speed); elsewhere it
# falls back to the encrypted tunnel. One ~/.ssh/config works everywhere.
#
# Credential (least privilege): pass a reusable, pre-authorized auth key scoped
# to tag:pollos via TS_AUTHKEY. Mint it in pollos/infra Terraform (tailscale
# provider) — do NOT hardcode it here.
#
# Usage:
#   TS_AUTHKEY=tskey-auth-xxxx ./005-tailscale.sh
#
# Optional env:
#   TS_TAGS=tag:pollos   ACL tags to advertise (must be allowed by the key)
#   TS_SSH=1             also enable Tailscale SSH (auth via tailnet identity)
#
# After this finishes, from your Mac:
#   tailscale status            # the box shows up by hostname
#   ssh <hostname>.pollos       # once ssh config HostName points at the MagicDNS name
#

: "${TS_AUTHKEY:?set TS_AUTHKEY to a pre-authorized tagged auth key}"
TS_TAGS="${TS_TAGS:-tag:pollos}"

# tailscale engine
curl -fsSL https://tailscale.com/install.sh | sh

# come back on every reboot. install.sh usually does this already; explicit +
# idempotent here. tailscaled persists the login, so the node reconnects on
# boot without re-running `tailscale up`.
systemctl enable --now tailscaled

# join the tailnet. re-running is harmless — tailscale up just reconciles state.
set -- \
  --auth-key="${TS_AUTHKEY}" \
  --hostname="$(hostname)" \
  --advertise-tags="${TS_TAGS}"
if [ "${TS_SSH:-0}" = "1" ]; then
  set -- "$@" --ssh
fi
tailscale up "$@"

echo
echo "tailscale up. node=$(hostname) ip=$(tailscale ip -4 2>/dev/null | head -n1)"
echo "from your Mac:  tailscale status  ->  ssh $(hostname).pollos"
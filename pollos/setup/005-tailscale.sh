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
# Usage (first join):
#   TS_AUTHKEY=tskey-auth-xxxx ./005-tailscale.sh
#
# Re-running is safe and idempotent: the install is skipped if Tailscale is
# already present, and TS_AUTHKEY is only required for the first join — once the
# node is authenticated you can re-run with no key to reconcile tags/SSH (so an
# expired 90-day key never blocks a re-run).
#
# Optional env:
#   TS_TAGS=tag:pollos   ACL tags to advertise (must be allowed by the key)
#   TS_SSH=1             also enable Tailscale SSH (auth via tailnet identity)
#
# After this finishes, from your Mac:
#   tailscale status            # the box shows up by hostname
#   ssh <hostname>.pollos       # once ssh config HostName points at the MagicDNS name
#

# installs packages, enables a systemd service, configures the daemon — all
# need root. bail early with a clear message rather than failing halfway.
if [ "$(id -u)" -ne 0 ]; then
  echo "run this as root (e.g. sudo -i first)." >&2
  exit 1
fi

TS_TAGS="${TS_TAGS:-tag:pollos}"

# already enrolled? then the auth key is optional — `tailscale up` just
# reconciles tags/SSH/hostname against the existing login. require a key only
# for the first join, so a re-run after the 90-day key expires still works.
if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
  echo "tailscale already authenticated; reconciling without an auth key."
else
  : "${TS_AUTHKEY:?set TS_AUTHKEY to a pre-authorized tagged auth key for the first join}"
fi

# tailscale engine — skip if already installed. download then run instead of
# piping curl straight into sh: a piped `curl ... | sh` takes the pipeline's
# exit status from sh (which exits 0 on empty stdin), and dash has no pipefail,
# so `set -e` would sail right past a failed download and break confusingly later.
if ! command -v tailscale >/dev/null 2>&1; then
  # mktemp, not a fixed /tmp path: world-writable /tmp + a predictable name +
  # running as root invites a symlink/tamper attack on the installer (CWE-377).
  install_tmp="$(mktemp)"
  # a bare EXIT trap won't fire when dash is killed by a signal; route the
  # common interrupts through `exit 1` so the temp file always gets cleaned up.
  trap 'rm -f "$install_tmp"' EXIT
  trap 'exit 1' INT TERM HUP
  curl -fsSL --retry 3 https://tailscale.com/install.sh > "$install_tmp"
  sh "$install_tmp"
  rm -f "$install_tmp"
  trap - EXIT INT TERM HUP
fi

# come back on every reboot. install.sh usually does this already; explicit +
# idempotent here. tailscaled persists the login, so the node reconnects on
# boot without re-running `tailscale up`.
systemctl enable --now tailscaled

# tailscaled needs a beat after install before its socket accepts commands;
# wait for it so the `tailscale up` below doesn't race a not-yet-ready daemon.
i=0
while [ ! -S /var/run/tailscale/tailscaled.sock ] && [ "$i" -lt 15 ]; do
  sleep 1
  i=$((i + 1))
done
if [ ! -S /var/run/tailscale/tailscaled.sock ]; then
  echo "tailscaled socket still absent after 15s; aborting." >&2
  exit 1
fi

# join the tailnet. re-running is harmless — tailscale up just reconciles state.
set -- \
  --hostname="$(hostname -s)" \
  --advertise-tags="${TS_TAGS}"
if [ "${TS_SSH:-0}" = "1" ]; then
  set -- "$@" --ssh
fi
# first join only: hand the key to tailscale through a 0600 temp file via
# --auth-key=file:, so the secret never lands in argv where `ps`/`/proc` would
# expose it to other local users. removed on any exit.
if [ -n "${TS_AUTHKEY:-}" ]; then
  # umask 077 so the file is 0600 even where mktemp's default is laxer.
  keyfile="$(umask 077 && mktemp)"
  # cover signal interrupts too — this file holds the auth key, so guarantee
  # it's wiped even on Ctrl-C / SIGTERM during `tailscale up`.
  trap 'rm -f "$keyfile"' EXIT
  trap 'exit 1' INT TERM HUP
  printf '%s' "${TS_AUTHKEY}" > "$keyfile"
  set -- "$@" --auth-key="file:${keyfile}"
fi
tailscale up "$@"

echo
echo "tailscale up. node=$(hostname -s) ip=$(tailscale ip -4 2>/dev/null | head -n1)"
echo "from your Mac:  tailscale status  ->  ssh $(hostname -s).pollos"
#!/bin/sh
set -eu

#
# PURPOSE: connect this host to its health tunnel, so it serves a public 200 at
#   https://<node>-health.pollos.cz
# over an outbound-only Cloudflare Tunnel (no ports exposed). BetterStack polls
# that URL and alerts when it stops returning 200 — i.e. when the host, its
# network, or the tunnel goes down.
#
# The tunnel, DNS record, the 200 response, and the BetterStack monitor are all
# created by Terraform in pollos/infra. This host gets ONLY a per-tunnel
# connector token — it can connect that one tunnel and nothing else.
#
# One script for every host — the pollos boxes and nas (the Pi), where a main
# tunnel already runs as cloudflared.service:
#
#   - the connector is always its own unit, cloudflared-health.service, so it
#     never collides with a main tunnel on the same host
#   - the token lives in /etc/cloudflared-health/token (root, 0600) and reaches
#     cloudflared through systemd's LoadCredential and --token-file, never the
#     unit file or the process list (--token-file needs cloudflared 2025.4.0+)
#   - the unit runs as a throwaway DynamicUser, sandboxed away from /mnt, /home,
#     other processes and localhost
#   - an existing cloudflared.service is removed only when it is an older health
#     connector for this same tunnel (compared by the tunnel id in the tokens);
#     a main tunnel is a different tunnel and is left alone
#   - cloudflared: installed from the latest GitHub .deb when missing, and kept
#     current that way on hosts without Cloudflare's apt repository; where that
#     repository is set up (nas), apt owns updates and this script does not
#
# MANUAL STEP: run on every host, as root, after 001-init.sh (needs curl). Grab
# its token with  make tunnel-tokens  in pollos/infra, or from the Cloudflare
# dashboard → Networking → Tunnels → health-<node>. Then on the host:
#
#   wget https://pollos.cz/monitoring.sh
#   sudo sh monitoring.sh          # prompts for the token — paste it
#
# Never pass the token as sudo TUNNEL_TOKEN=... on the command line: sudo
# writes the variables it was given into the journal, where it outlives the
# session. The prompt reads it without echo and without logging.
#
# The node name defaults to the short hostname; pass HEALTH_NODE=<node> if the
# host is called something other than its tunnel (health-<node>). It only names
# the prompt and the check URL — the token decides the tunnel.
#
# Other subcommands (no root, no network — they are what the tests call):
#
#   sh monitoring.sh version-ok 2026.7.1        # exit 0 if it has --token-file
#   sh monitoring.sh same-tunnel UNIT TOKEN     # exit 0 if UNIT runs TOKEN's tunnel
#   sudo sh monitoring.sh uninstall             # remove this unit and its token
#
# Safe to re-run: rewrites the token and the unit, then restarts the unit.
#

UNIT=cloudflared-health
UNIT_FILE="/etc/systemd/system/${UNIT}.service"
CONF_DIR="/etc/${UNIT}"
OLD_UNIT_FILE=/etc/systemd/system/cloudflared.service
MIN_VERSION=2025.4.0 # first release with --token-file
NODE="${HEALTH_NODE:-$(hostname -s)}"

# version_ok <version> — true when <version> (YYYY.M.P) is at least MIN_VERSION.
# An unparseable version is a failure, never a pass.
version_ok() {
  printf '%s\n' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || return 1
  lowest="$(printf '%s\n%s\n' "$MIN_VERSION" "$1" | sort -t. -k1,1n -k2,2n -k3,3n | head -n1)"
  [ "$lowest" = "$MIN_VERSION" ]
}

# tunnel_id <token> — the tunnel id ("t") inside a connector token, which is
# base64 of {"a": account, "t": tunnel, "s": secret}. Empty when it is not one.
tunnel_id() {
  t=$1
  case $((${#t} % 4)) in
    2) t="$t==" ;;
    3) t="$t=" ;;
  esac
  printf '%s' "$t" | tr '_-' '/+' | base64 -d 2>/dev/null \
    | sed -n 's/.*"t" *: *"\([^"]*\)".*/\1/p'
}

# unit_token <unit file> — the token a cloudflared unit runs with: inline after
# --token (cloudflared 2026.7.1 and older wrote it there), or read from the file
# after --token-file (2026.7.2 and newer write /etc/cloudflared/token).
unit_token() {
  exec_line="$(grep -m1 '^ExecStart=' "$1" 2>/dev/null || true)"
  inline="$(printf '%s\n' "$exec_line" | sed -n 's/.*--token[ =]\([^ ]*\).*/\1/p')"
  if [ -n "$inline" ]; then
    printf '%s' "$inline"
    return
  fi
  file="$(printf '%s\n' "$exec_line" | sed -n 's/.*--token-file[ =]\([^ ]*\).*/\1/p')"
  if [ -n "$file" ] && [ -r "$file" ]; then
    tr -d '[:space:]' < "$file"
  fi
}

# same_tunnel <unit file> <token> — true when the unit connects the same tunnel
# as the token. This decides whether an existing cloudflared.service is an old
# health connector (replace it) or a main tunnel (leave it): getting it wrong
# takes a host's published apps offline, hence its own subcommand and test.
same_tunnel() {
  new="$(tunnel_id "$2")"
  old="$(tunnel_id "$(unit_token "$1")")"
  [ -n "$new" ] && [ "$new" = "$old" ]
}

case "${1:-install}" in
  version-ok)
    [ -n "${2:-}" ] || { echo "usage: $0 version-ok <version>"; exit 2; }
    version_ok "$2"
    exit
    ;;
  same-tunnel)
    { [ -n "${2:-}" ] && [ -n "${3:-}" ]; } || { echo "usage: $0 same-tunnel <unit file> <token>"; exit 2; }
    same_tunnel "$2" "$3"
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
    echo "usage: $0 [install|uninstall|version-ok <version>|same-tunnel <unit file> <token>]"
    exit 2
    ;;
esac

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

# token: from $TUNNEL_TOKEN if set, else prompt — but only on a real terminal,
# never when piped (curl | sh), where a prompt would read the script itself.
if [ -z "${TUNNEL_TOKEN:-}" ] && [ -t 0 ]; then
  printf 'Paste the connector token for health-%s (Cloudflare → Networking → Tunnels): ' "$NODE"
  stty -echo 2>/dev/null || true
  read -r TUNNEL_TOKEN || true
  stty echo 2>/dev/null || true
  printf '\n'
fi
[ -n "${TUNNEL_TOKEN:-}" ] || { echo "no token — run interactively, or see the header"; exit 1; }
[ -n "$(tunnel_id "$TUNNEL_TOKEN")" ] || { echo "that is not a tunnel token — copy it again"; exit 1; }

# cloudflared: the latest GitHub .deb, unless Cloudflare's apt repository owns it
if [ ! -x /usr/bin/cloudflared ] || ! grep -rqs 'pkg.cloudflare.com' /etc/apt/sources.list /etc/apt/sources.list.d/; then
  ARCH="$(dpkg --print-architecture)"
  TMP_DEB="$(mktemp --suffix=.deb)"
  curl -fsSL -o "$TMP_DEB" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
  apt-get install -y "$TMP_DEB" # local .deb: apt resolves deps in one step
  rm -f "$TMP_DEB"
fi
BIN=/usr/bin/cloudflared
VERSION="$("$BIN" --version | awk '{print $3}')"
version_ok "$VERSION" || { echo "cloudflared ${VERSION} is older than ${MIN_VERSION} (no --token-file) — update it first"; exit 1; }

# an older health connector for this tunnel, installed as cloudflared.service
if [ -f "$OLD_UNIT_FILE" ] && same_tunnel "$OLD_UNIT_FILE" "$TUNNEL_TOKEN"; then
  echo "replacing the old health connector in cloudflared.service (same tunnel)"
  cloudflared service uninstall >/dev/null 2>&1 || true
  rm -f "$OLD_UNIT_FILE" /etc/cloudflared/token
  systemctl daemon-reload
fi

# token + a config of its own: the token root-only, the config readable by the unit
install -d -m 0755 "$CONF_DIR"
( umask 077 && printf '%s\n' "$TUNNEL_TOKEN" > "${CONF_DIR}/token" )
cat > "${CONF_DIR}/config.yml" <<'EOF'
# cloudflared-health.service only — the health tunnel's ingress lives in
# Terraform (pollos/infra/monitoring.tf). This file exists so cloudflared does
# not fall back to a main tunnel's /etc/cloudflared/config.yml.
no-autoupdate: true
# a fixed port outside 20241-20245: without one, whichever connector starts
# first takes 20241 and a main tunnel's metrics move to another port
metrics: 127.0.0.1:20299
EOF
chmod 0644 "${CONF_DIR}/config.yml"

cat > "$UNIT_FILE" <<EOF
# Written by pollos/setup/003-monitoring.sh — re-run it rather than editing.
[Unit]
Description=cloudflared health tunnel connector
After=network-online.target cloudflared.service
Wants=network-online.target

[Service]
Type=notify
DynamicUser=yes
LoadCredential=token:${CONF_DIR}/token
ExecStart=${BIN} tunnel --config ${CONF_DIR}/config.yml run --token-file %d/token
# DynamicUser already makes the system read-only; these also hide other
# users' processes and the data under /mnt (a RAID, apps' env files)
ProtectHome=yes
ProtectProc=invisible
ProcSubset=pid
InaccessiblePaths=-/mnt
# nothing on localhost is its business: on nas, Loki and Prometheus listen
# there with no auth, and a leaked pollos token could otherwise point this
# tunnel at them. The one exception is systemd-resolved's stub, for DNS.
IPAddressDeny=localhost
IPAddressAllow=127.0.0.53/32
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
echo "verify (after ~10s):  systemctl status ${UNIT}"
echo "                      ps -eo args | grep [c]loudflared   # --token-file, never a token"
echo "                      curl -sI https://${NODE}-health.pollos.cz"

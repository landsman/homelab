#!/bin/sh
set -eu

#
# PURPOSE: give this box a public health URL ( https://<host>.health.pollos.cz )
# that returns HTTP 200 while the box is alive, served over an outbound-only
# Cloudflare Tunnel so no ports are exposed. BetterStack polls that URL on a
# schedule and alerts when it stops returning 200 — i.e. when the box, its
# network, or the tunnel goes down.
#
# MANUAL STEP: run on every pollos box (gus, mike, walter, jesse), as root,
# after 001-init.sh (needs curl + python3).
#
#   curl -fsSL https://pollos.cz/monitoring.sh -o monitoring.sh
#   sudo MONITORING_CF_TOKEN=xxxxxxxx sh monitoring.sh
#
# Stands up a per-node Cloudflare Tunnel that answers HTTP 200 — a health
# endpoint for uptime monitoring. The tunnel is OUTBOUND ONLY: cloudflared
# dials out from this box to Cloudflare and holds the connection open. No
# inbound ports, no port-forwarding, no firewall changes. Cloudflare routes
#   <host>.health.pollos.cz  back down the tunnel and cloudflared itself
# returns 200 — there is no backend service to run or crash. When the box,
# its network, or cloudflared dies, the connector count drops to 0 and the
# URL returns a Cloudflare error instead of 200.
#
# One per box → one tunnel per box, so each node is up/down independently.
#
# UPTIME MONITORING is done in BetterStack: add each
#   https://<host>.health.pollos.cz  as an HTTP monitor expecting status 200.
# BetterStack polls the URLs and alerts when one stops returning 200.
# (Optional belt-and-suspenders: Cloudflare Zero Trust → Settings →
# Notifications → "Tunnel health" alerts when a connector count hits 0.)
#
# MONITORING_CF_TOKEN is the only secret and is read from the environment at
# runtime only — never written to disk, never in the repo. Create a dedicated,
# single-purpose, least-privilege token (revoke it when provisioning is done)
# at  Cloudflare dashboard → My Profile → API Tokens → Create Token (Custom):
#     Account › Cloudflare Tunnel › Edit
#     Zone    › DNS              › Edit   (zone: pollos.cz)
#     Zone    › Zone             › Read   (zone: pollos.cz)
# That is the entire job — it cannot touch anything else in the account.
# Reuse the same token on all four boxes.
#
# Safe to re-run: reuses local credentials, upgrades cloudflared.
#
# Override defaults via env, e.g.:  ZONE=example.com HEALTH_LABEL=up sh monitoring.sh
#

ZONE="${ZONE:-pollos.cz}"
HEALTH_LABEL="${HEALTH_LABEL:-health}"          # endpoint = <host>.<label>.<zone>
: "${MONITORING_CF_TOKEN:?set MONITORING_CF_TOKEN — see header for the dedicated token + scopes}"

HOST="$(hostname -s)"
FQDN="${HOST}.${HEALTH_LABEL}.${ZONE}"
TUNNEL_NAME="health-${HOST}"
API="https://api.cloudflare.com/client/v4"

CF_DIR="/etc/cloudflared"
CREDS="${CF_DIR}/${TUNNEL_NAME}.json"
CONFIG="${CF_DIR}/config.yml"

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

# tiny Cloudflare API helpers --------------------------------------------------
api() { # api METHOD PATH [JSON_BODY]
  _m="$1"; _p="$2"
  if [ "$#" -gt 2 ]; then
    curl -fsS -X "$_m" "${API}${_p}" \
      -H "Authorization: Bearer ${MONITORING_CF_TOKEN}" \
      -H "Content-Type: application/json" --data "$3"
  else
    curl -fsS -X "$_m" "${API}${_p}" -H "Authorization: Bearer ${MONITORING_CF_TOKEN}"
  fi
}
jget() { python3 -c 'import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))' "$1"; }

# resolve account + zone (override via env to skip the lookups) ----------------
ACCOUNT_ID="${CF_ACCOUNT_ID:-$(api GET /accounts | jget 'd["result"][0]["id"]')}"
ZONE_ID="${CF_ZONE_ID:-$(api GET "/zones?name=${ZONE}" | jget 'd["result"][0]["id"]')}"

# install cloudflared (latest .deb, independent of Debian release) -------------
ARCH="$(dpkg --print-architecture)"             # amd64 on the prodesks
TMP_DEB="$(mktemp --suffix=.deb)"
curl -fsSL -o "$TMP_DEB" \
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
dpkg -i "$TMP_DEB" || apt-get install -f -y
rm -f "$TMP_DEB"

install -d -m 0700 "$CF_DIR"

# create (or reuse) the tunnel -------------------------------------------------
if [ -f "$CREDS" ]; then
  TUNNEL_ID="$(jget 'd["TunnelID"]' < "$CREDS")"
  echo "reusing existing tunnel ${TUNNEL_NAME} (${TUNNEL_ID})"
else
  STALE="$(api GET "/accounts/${ACCOUNT_ID}/cfd_tunnel?name=${TUNNEL_NAME}&is_deleted=false" \
    | jget 'd["result"][0]["id"] if d["result"] else ""')"
  if [ -n "$STALE" ]; then
    echo "deleting stale tunnel ${TUNNEL_NAME} (${STALE}) to recreate with fresh creds"
    api DELETE "/accounts/${ACCOUNT_ID}/cfd_tunnel/${STALE}?cascade=true" >/dev/null
  fi
  SECRET="$(python3 -c 'import base64,secrets;print(base64.b64encode(secrets.token_bytes(32)).decode())')"
  TUNNEL_ID="$(api POST "/accounts/${ACCOUNT_ID}/cfd_tunnel" \
    "{\"name\":\"${TUNNEL_NAME}\",\"tunnel_secret\":\"${SECRET}\",\"config_src\":\"local\"}" \
    | jget 'd["result"]["id"]')"
  printf '{"AccountTag":"%s","TunnelID":"%s","TunnelSecret":"%s"}\n' \
    "$ACCOUNT_ID" "$TUNNEL_ID" "$SECRET" > "$CREDS"
  chmod 600 "$CREDS"
  echo "created tunnel ${TUNNEL_NAME} (${TUNNEL_ID})"
fi

# point  <host>.health.pollos.cz  at this tunnel (proxied) ---------------------
CONTENT="${TUNNEL_ID}.cfargotunnel.com"
DNS_BODY="{\"type\":\"CNAME\",\"name\":\"${FQDN}\",\"content\":\"${CONTENT}\",\"proxied\":true}"
REC_ID="$(api GET "/zones/${ZONE_ID}/dns_records?type=CNAME&name=${FQDN}" \
  | jget 'd["result"][0]["id"] if d["result"] else ""')"
if [ -n "$REC_ID" ]; then
  api PUT "/zones/${ZONE_ID}/dns_records/${REC_ID}" "$DNS_BODY" >/dev/null
else
  api POST "/zones/${ZONE_ID}/dns_records" "$DNS_BODY" >/dev/null
fi

# config: cloudflared answers 200 itself, no backend service -------------------
cat > "$CONFIG" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS}
no-autoupdate: true

ingress:
  - service: http_status:200
EOF
cloudflared --config "$CONFIG" tunnel ingress validate

# install + (re)start the systemd service --------------------------------------
if [ -f /etc/systemd/system/cloudflared.service ]; then
  systemctl restart cloudflared
else
  cloudflared service install
fi
systemctl enable cloudflared >/dev/null 2>&1 || true

echo
echo "done. health endpoint:  https://${FQDN}"
echo "verify (after ~10s):    curl -sI https://${FQDN} | head -1   # expect HTTP/2 200"
echo "then add it as an HTTP monitor (expect 200) in BetterStack."
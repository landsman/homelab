#!/bin/sh
set -eu

#
# Print hostname + MAC + IPv4 for every non-loopback interface.
# Use to copy into router DHCP reservations + ansible inventory.
# Safe to re-run anytime.
#

HOST=$(hostname)

echo "================ COPY THIS INTO ROUTER + INVENTORY ================"
printf "hostname : %s\n" "$HOST"
ip -o link show | awk -F': ' '!/lo:/ {print $2}' | while read -r iface; do
  mac="$(cat "/sys/class/net/${iface}/address")"
  ipv4="$(ip -4 -o addr show dev "${iface}" | awk '{print $4}' | paste -sd, -)"
  printf "  %-12s mac=%s  ipv4=%s\n" "${iface}" "${mac}" "${ipv4:-none}"
done
echo "===================================================================="

# first global IPv4 (skip loopback + link-local), stripped of CIDR mask
IPV4=$(ip -4 -o addr show scope global | awk 'NR==1 {split($4,a,"/"); print a[1]}')

cat <<EOF

================ APPEND THIS TO LAPTOP ~/.ssh/config ================
# one-time block (add once, covers every *.pollos host):
# Host *.pollos
#   User ansible
#   IdentityFile ~/.ssh/id_ed25519_homelab
#   IdentitiesOnly yes

Host ${HOST}.pollos
  HostName ${IPV4}
=====================================================================
EOF
#!/bin/sh
set -eu

#
# Print hostname + MAC + IPv4 for every non-loopback interface.
# Use to copy into router DHCP reservations + ansible inventory.
# Safe to re-run anytime.
#

echo "================ COPY THIS INTO ROUTER + INVENTORY ================"
printf "hostname : %s\n" "$(hostname)"
ip -o link show | awk -F': ' '!/lo:/ {print $2}' | while read -r iface; do
  mac="$(cat "/sys/class/net/${iface}/address")"
  ipv4="$(ip -4 -o addr show dev "${iface}" | awk '{print $4}' | paste -sd, -)"
  printf "  %-12s mac=%s  ipv4=%s\n" "${iface}" "${mac}" "${ipv4:-none}"
done
echo "===================================================================="
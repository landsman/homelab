#!/usr/bin/env bash
# Re-exec under bash when launched as `sh script.sh` — minimal Debian's /bin/sh
# is dash, which doesn't grok the array + here-string syntax used below.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"

#
# MANUAL STEP: run this on every fresh Debian 13 box at the console, as root.
# Each box must be touched individually — there is no SSH yet.
#
# What it does:
#   - installs base packages incl. openssh-server + chrony
#   - creates the 'ansible' user with passwordless sudo (used for remote admin)
#   - leaves the 'containers' user as a rootless workload user (enables linger)
#   - prints hostname + MAC + IPv4 for DHCP reservation + inventory
#
# After running on all boxes:
#   1. add DHCP reservations on the router (MAC -> fixed IP)
#   2. from laptop, push your SSH key to the ansible user (see README)
#
set -eu

apt-get update -y
PACKAGES=(
  openssh-server   # remote login; not present on minimal Debian
  sudo             # ansible user escalates via sudo
  ca-certificates  # TLS roots for apt + curl over https
  curl             # fetching k3s/helm install scripts later
  gnupg            # verifying apt repo signatures (docker, k3s, etc.)
  vim              # edit configs locally when ssh dies
  htop             # quick cpu/ram check
  screenfetch      # pretty system info banner on login
  chrony           # NTP client; k3s + TLS hate clock drift
  python3          # Ansible interpreter on managed nodes
  python3-apt      # lets Ansible's apt module work out of the box
  uidmap           # subuid/subgid tools for rootless containers
  slirp4netns      # user-mode networking for rootless containers
  fuse-overlayfs   # rootless overlayfs storage driver
)
apt-get install -y "${PACKAGES[@]}"

systemctl enable --now ssh
systemctl enable --now chrony

# ansible: admin user for remote management, passwordless sudo
id ansible >/dev/null 2>&1 || useradd -m -s /bin/bash ansible
install -m 0440 /dev/stdin /etc/sudoers.d/ansible <<<'ansible ALL=(ALL) NOPASSWD:ALL'

# containers: rootless workload user; enable user-level systemd at boot
loginctl enable-linger containers

echo
echo "================ COPY THIS INTO ROUTER + INVENTORY ================"
printf "hostname : %s\n" "$(hostname)"
ip -o link show | awk -F': ' '!/lo:/ {print $2}' | while read -r iface; do
  mac="$(cat "/sys/class/net/${iface}/address")"
  ipv4="$(ip -4 -o addr show dev "${iface}" | awk '{print $4}' | paste -sd, -)"
  printf "  %-12s mac=%s  ipv4=%s\n" "${iface}" "${mac}" "${ipv4:-none}"
done
echo "===================================================================="
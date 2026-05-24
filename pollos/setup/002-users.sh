#!/bin/sh
set -eu

#
# MANUAL STEP: run on every fresh box at the console, as root, after 001-init.sh.
#
# What it does:
#   - creates the 'ansible' user with passwordless sudo (used for remote admin)
#     and seeds authorized_keys from a pubkey pasted at the console.
#     Password stays locked — key auth only.
#   - creates the 'containers' user as a rootless workload user (enables linger)
#
# Get your pubkey on the laptop with:  cat ~/.ssh/id_ed25519.pub
# then paste it at the prompt below.
#

# ansible: admin user for remote management, passwordless sudo, key auth only
id ansible >/dev/null 2>&1 || useradd -m -s /bin/bash ansible
usermod -L ansible

printf "paste ansible SSH pubkey (ssh-ed25519 ... or ssh-rsa ...):\n> "
read -r PUBKEY
case "$PUBKEY" in
  ssh-*) : ;;
  *) echo "ERROR: not a valid pubkey (must start with 'ssh-')" >&2; exit 1 ;;
esac

install -d -m 0700 -o ansible -g ansible /home/ansible/.ssh
printf '%s\n' "$PUBKEY" > /home/ansible/.ssh/authorized_keys
chown ansible:ansible /home/ansible/.ssh/authorized_keys
chmod 0600 /home/ansible/.ssh/authorized_keys

echo 'ansible ALL=(ALL) NOPASSWD:ALL' | install -m 0440 /dev/stdin /etc/sudoers.d/ansible

# containers: rootless workload user; no login, just linger for user-level systemd
id containers >/dev/null 2>&1 || useradd -m -s /bin/bash containers
loginctl enable-linger containers

echo
echo "users ready. test from laptop: ssh ansible@<ip>"
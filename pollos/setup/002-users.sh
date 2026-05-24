#!/bin/sh
set -eu

#
# MANUAL STEP: run on every fresh box at the console, as root, after 001-init.sh.
#
# What it does:
#   - creates the 'ansible' user with passwordless sudo (used for remote admin)
#     and seeds authorized_keys with the hardcoded admin pubkey below.
#     Password stays locked — key auth only.
#   - creates the 'containers' user as a rootless workload user (enables linger)
#
# To rotate the admin key: replace ANSIBLE_PUBKEY below, re-run on every box.
#

#
# ssh-keygen -t ed25519 -C "landsman@homelab" -f ~/.ssh/id_ed25519_homelab
# cat ~/.ssh/id_ed25519_homelab.pub
#
ANSIBLE_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII8ozvm2xylksMdI5EAQ3O4Bn5nNP0HqFTbaAfh/l5Od landsman@homelab'

# ansible: admin user for remote management, passwordless sudo, key auth only
id ansible >/dev/null 2>&1 || useradd -m -s /bin/bash ansible
usermod -L ansible

install -d -m 0700 -o ansible -g ansible /home/ansible/.ssh
printf '%s\n' "$ANSIBLE_PUBKEY" > /home/ansible/.ssh/authorized_keys
chown ansible:ansible /home/ansible/.ssh/authorized_keys
chmod 0600 /home/ansible/.ssh/authorized_keys

echo 'ansible ALL=(ALL) NOPASSWD:ALL' | install -m 0440 /dev/stdin /etc/sudoers.d/ansible

# containers: rootless workload user; no login, just linger for user-level systemd
id containers >/dev/null 2>&1 || useradd -m -s /bin/bash containers
loginctl enable-linger containers

echo
echo "users ready. test from laptop: ssh ansible@<ip>"
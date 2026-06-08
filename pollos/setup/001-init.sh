#!/bin/sh
set -eu

#
# MANUAL STEP: run on every fresh Debian 13 box at the console, as root.
#
# What it does:
#   - installs base packages incl. openssh-server + chrony
#   - enables ssh + chrony
#   - generates en_US.UTF-8 locale and sets it as system default
#     (otherwise SSH clients forwarding cs_CZ.UTF-8 / other locales spam
#     "Can't set locale" warnings on every apt/perl invocation)
#
# Packages installed from apt:
#   openssh-server   remote login; not present on minimal Debian
#   sudo             ansible user escalates via sudo
#   ca-certificates  TLS roots for apt + curl over https
#   curl             fetching k3s/helm install scripts later
#   gnupg            verifying apt repo signatures (docker, k3s, etc.)
#   locales          generate UTF-8 locales so SSH-forwarded LC_* doesn't whine
#   vim              edit configs locally when ssh dies
#   htop             quick cpu/ram check
#   screenfetch      pretty system info banner on login
#   hstr             fuzzy shell history search — https://github.com/dvorka-oss/hstr
#   chrony           NTP client; k3s + TLS hate clock drift
#   python3          Ansible interpreter on managed nodes
#   python3-apt      lets Ansible's apt module work out of the box
#   uidmap           subuid/subgid tools for rootless containers
#   slirp4netns      user-mode networking for rootless containers
#   fuse-overlayfs   rootless overlayfs storage driver
#   make             automatisation for apps builds
#   rsync            sync files form host <> remote
#   unzip            open compressed archives
#   tmux             terminal multiplexer

apt-get update -y
apt-get install -y \
  openssh-server \
  sudo \
  ca-certificates \
  curl \
  gnupg \
  locales \
  vim \
  htop \
  btop \
  screenfetch \
  hstr \
  chrony \
  python3 \
  python3-apt \
  uidmap \
  slirp4netns \
  fuse-overlayfs \
  make \
  rsync \
  unzip \
  tmux

systemctl enable --now ssh
systemctl enable --now chrony

# Locale: enable en_US.UTF-8 in /etc/locale.gen, generate, set as default.
# Idempotent — sed is a no-op if line is already uncommented, locale-gen
# rebuilds existing locales harmlessly.
sed -i 's/^# *\(en_US\.UTF-8 UTF-8\)/\1/' /etc/locale.gen
locale-gen
update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

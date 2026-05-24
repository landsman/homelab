#!/bin/sh
set -eu

#
# MANUAL STEP: run on every fresh box at the console, as root, after 001-init.sh.
#
# Extras not in the Debian repos.
#   yazi         blazing-fast TUI file manager — https://github.com/sxyazi/yazi
#                installed via Dario Griffo's third-party apt repo
#                https://debian.griffo.io
#   lazyjournal  TUI for journald logs — https://github.com/Lifailon/lazyjournal
#                installed via the upstream PPA (works on Debian thanks to
#                software-properties-common)
#

# Debian codename (trixie, bookworm, ...) — read from os-release to avoid lsb-release dep
. /etc/os-release

# yazi via griffo.io apt repo
curl -sS https://debian.griffo.io/EA0F721D231FDD3A0A17B9AC7808B4DD62C41256.asc \
  | gpg --dearmor --yes -o /etc/apt/trusted.gpg.d/debian.griffo.io.gpg
echo "deb https://debian.griffo.io/apt ${VERSION_CODENAME} main" \
  > /etc/apt/sources.list.d/debian.griffo.io.list
apt-get update -y
apt-get install -y yazi

# lazyjournal via upstream PPA — needs add-apt-repository (software-properties-common)
apt-get install -y software-properties-common
add-apt-repository -y ppa:lifailon/lazyjournal
apt-get update -y
apt-get install -y lazyjournal
#!/bin/sh
set -eu

#
# MANUAL STEP: run on every fresh box at the console, as root, after 003-docker.sh.
#
# What it does:
#   - installs Bun globally to /usr/local/bin from the GitHub release zip
#     (the official curl|bash installer drops it under $HOME/.bun, which on
#      a root run only benefits root — we want every user to see `bun`).
#

case "$(uname -m)" in
  x86_64)  BUN_ARCH=x64 ;;
  aarch64) BUN_ARCH=aarch64 ;;
  *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac

# unzip + curl come from 001-init.sh
TMPDIR=$(mktemp -d)
curl -fsSL -o "${TMPDIR}/bun.zip" \
  "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-${BUN_ARCH}.zip"
unzip -q "${TMPDIR}/bun.zip" -d "${TMPDIR}"
install -m 0755 "${TMPDIR}/bun-linux-${BUN_ARCH}/bun" /usr/local/bin/bun
rm -rf "${TMPDIR}"

bun --version
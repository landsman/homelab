#!/bin/sh
set -eu

# bun
curl -fsSL https://bun.sh/install | bash
# shellcheck disable=SC1090
source ~/.bashrc
bun --version

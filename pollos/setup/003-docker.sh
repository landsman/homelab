#!/bin/sh
set -eu

#
# MANUAL STEP: run on every fresh box at the console, as root, after 002-users.sh.
#
# What it does:
#   - installs Docker via the official get.docker.com script
#   - adds 'ansible' and 'containers' users to the docker group
#   - installs lazydocker from GitHub releases (arm64)
#
# After this finishes, log out and back in (or `newgrp docker`) so group
# membership takes effect, then sanity-check with:
#   sudo -u containers docker run --rm hello-world
#

# docker engine
curl -fsSL https://get.docker.com | sh

# allow the workload + admin users to talk to the docker socket
usermod -aG docker containers
usermod -aG docker ansible

# lazydocker (not in apt — pull release tarball from GitHub)
case "$(uname -m)" in
  x86_64)  LAZYDOCKER_ARCH=x86_64 ;;
  aarch64) LAZYDOCKER_ARCH=arm64 ;;
  armv7l)  LAZYDOCKER_ARCH=armv7 ;;
  *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac
LAZYDOCKER_VERSION=$(curl -fsSL https://api.github.com/repos/jesseduffield/lazydocker/releases/latest \
  | grep -oE '"tag_name":\s*"v[^"]+"' | head -n1 | sed -E 's/.*"v([^"]+)".*/\1/')
TMPDIR=$(mktemp -d)
curl -fsSL -o "${TMPDIR}/lazydocker.tar.gz" \
  "https://github.com/jesseduffield/lazydocker/releases/download/v${LAZYDOCKER_VERSION}/lazydocker_${LAZYDOCKER_VERSION}_Linux_${LAZYDOCKER_ARCH}.tar.gz"
tar -xzf "${TMPDIR}/lazydocker.tar.gz" -C "${TMPDIR}" lazydocker
install -m 0755 "${TMPDIR}/lazydocker" /usr/local/bin/lazydocker
rm -rf "${TMPDIR}"

echo
echo "docker ready. log out + back in (or 'newgrp docker') before running docker as containers/ansible."
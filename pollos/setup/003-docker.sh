#!/bin/sh
set -eu

#
# MANUAL STEP: run on every fresh box at the console, as root, after 002-users.sh.
#
# What it does:
#   - installs Docker via the official get.docker.com script
#   - adds 'ansible' and 'containers' users to the docker group
#   - installs lazydocker from GitHub releases (arm64)
#   - asks whether this box should run a single-node swarm, and makes one if so
#
# Answer the swarm question with SWARM=yes or SWARM=no to skip the prompt, which a piped run has
# to do: in `wget -qO- … | sh` the script itself is on stdin, so there is nothing to read from.
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

#
# A single-node swarm, for a box that hosts a stack. Most boxes never need one, so it is a question
# rather than a step.
#

swarm_wanted() {
	case "${SWARM:-}" in
	yes | y) return 0 ;;
	no | n) return 1 ;;
	esac
	if [ ! -r /dev/tty ]; then
		echo "not a terminal — skipping the swarm question. Re-run with SWARM=yes to add one."
		return 1
	fi
	printf 'Run a Docker Swarm stack on this box? [y/N] ' >/dev/tty
	read -r answer </dev/tty
	case "$answer" in
	y | Y | yes) return 0 ;;
	*) return 1 ;;
	esac
}

if swarm_wanted; then
	if [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" = active ]; then
		echo "already in a swarm ($(docker info --format '{{if .Swarm.ControlAvailable}}manager{{else}}worker{{end}}')) — left alone"
	else
		# The address is computed, not given. `--advertise-addr eno1` is refused here: the interface
		# carries two IPv6 addresses (SLAAC and privacy) and the daemon will not choose between them,
		# and a box has a LAN address and a tailnet one, so swarm will not either. Writing the IPv4
		# in would be a lie the first time DHCP hands out another.
		IFACE=${IFACE:-eno1}
		addr=$(ip -4 -o addr show "$IFACE" | awk '{print $4}' | cut -d/ -f1)
		[ -n "$addr" ] || {
			echo "no IPv4 on $IFACE — set IFACE to the interface to advertise" >&2
			exit 1
		}
		echo "initialising a single-node swarm, advertising $addr"
		docker swarm init --advertise-addr "$addr" >/dev/null
		echo "this box is now $(docker node ls --format '{{.Hostname}} {{.Status}} {{.ManagerStatus}}')"
		# `docker swarm init` prints a worker join token, and anything reaching this box on 2377 can
		# join with it. Not into a chat, a ticket or a log; if it is seen, rotate both:
		#   docker swarm join-token --rotate worker   (and --rotate manager)
		echo "note: 'docker swarm join-token worker' prints a credential — treat it as one"
	fi
fi

echo
echo "docker ready. log out + back in (or 'newgrp docker') before running docker as containers/ansible."
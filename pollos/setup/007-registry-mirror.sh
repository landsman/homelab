#!/bin/sh
set -eu

#
# MANUAL STEP: run as root on a box whose Docker pulls images — the CI runners (jesse, walter)
# first. After 003-docker.sh and 005-tailscale.sh.
#
# Points Docker at the registry caches on the NAS (../../registry-mirror), one per registry at
# https://<nas>/mirror/<registry>, so a pull reaches the registry itself only when the cache does
# not have the image. Docker goes to the
# registry by itself when its cache does not answer, so a NAS outage slows a pull down and does not
# break it.
#
#   NAS=<nas>.<tailnet>.ts.net ./007-registry-mirror.sh   # use the caches
#   NAS=off ./007-registry-mirror.sh                      # stop using them
#
# It writes /etc/docker/certs.d/<registry>/hosts.toml for each registry below, which Docker reads
# on every pull and every build, so nothing restarts. That needs Docker's containerd image store,
# which jesse and walter use (`io.containerd.snapshotter.v1` in `docker info`); the classic store
# pulls without reading hosts.toml, so the script refuses to run there.
#

CERTS_D=${CERTS_D:-/etc/docker/certs.d}
NAS=${NAS:?set NAS to the NAS tailnet name, <nas>.<tailnet>.ts.net, or to off}

# The registry, and the host its server answers on. Each has a cache under /mirror/<registry>, set
# up by SERVE in ../../registry-mirror/Makefile.
REGISTRIES='docker.io registry-1.docker.io
ghcr.io ghcr.io
docker.gitea.com docker.gitea.com
code.forgejo.org code.forgejo.org'

case "$NAS" in
off) ;;
*[!a-z0-9.-]*)
	echo "NAS must be a host name such as <nas>.<tailnet>.ts.net, or off; got: $NAS" >&2
	exit 1
	;;
*)
	# The containerd store prints `io.containerd.snapshotter.v1` here (DriverStatus [[driver-type …]]).
	# A refusal on a box that does use it means a Docker upgrade moved that string: check `docker info`.
	case "$(docker info --format '{{range .DriverStatus}}{{index . 1}} {{end}}')" in
	*io.containerd.snapshotter.v1*) ;;
	*)
		echo "this Docker does not use the containerd image store, which is what reads hosts.toml" >&2
		exit 1
		;;
	esac
	;;
esac

echo "$REGISTRIES" | while read -r registry server; do
	dir=$CERTS_D/$registry
	if [ "$NAS" = off ]; then
		rm -f "$dir/hosts.toml"
		# Only when empty: a CA certificate for the registry may live in the same directory.
		rmdir "$dir" 2>/dev/null || true
		echo "$registry: straight to $server"
		continue
	fi
	mkdir -p "$dir"
	# Docker appends /v2 to the mirror's path itself, which is where the cache answers. Without a
	# dial timeout, a NAS that is off made every pull wait out the connect timeout first: 182 s for
	# one image, against 20 s with 3 s.
	printf 'server = "https://%s"\n\n[host."https://%s/mirror/%s"]\n  capabilities = ["pull", "resolve"]\n  dial_timeout = "3s"\n' \
		"$server" "$NAS" "$registry" >"$dir/hosts.toml.tmp"
	mv "$dir/hosts.toml.tmp" "$dir/hosts.toml"
	echo "$registry: through https://$NAS/mirror/$registry"
done

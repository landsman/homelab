#!/bin/sh
set -eu

#
# MANUAL STEP: run as root on a box whose Docker pulls images — the CI runners (jesse, walter)
# first. After 003-docker.sh and 005-tailscale.sh.
#
# Points Docker at the Docker Hub pull-through cache on the NAS (../../registry-mirror), so a pull
# reaches Docker Hub only when the cache does not have the image. Docker falls back to Docker Hub by
# itself when the mirror does not answer, so a NAS outage slows a pull down and does not break it.
#
#   MIRROR=https://<nas>.<tailnet>.ts.net:5000 ./007-registry-mirror.sh   # use the cache
#   MIRROR=off ./007-registry-mirror.sh                                   # stop using it
#
# This script owns /etc/docker/daemon.json and writes all of it: a setting the boxes need goes in
# here, not into the file by hand. Safe to re-run: it reloads dockerd only when the file changed,
# and a reload applies `registry-mirrors` without restarting a single container, the runner included.
#

DAEMON_JSON=${DAEMON_JSON:-/etc/docker/daemon.json}
MIRROR=${MIRROR:?set MIRROR to the cache URL, https://<nas>.<tailnet>.ts.net:5000, or to off}

case "$MIRROR" in
# No file at all: dockerd reloads to its defaults when the default daemon.json is missing.
off) want= ;;
https://*) want=$(printf '{\n  "registry-mirrors": ["%s"]\n}' "$MIRROR") ;;
*)
	echo "MIRROR must be an https:// URL or off, got: $MIRROR" >&2
	exit 1
	;;
esac

have=$(cat "$DAEMON_JSON" 2>/dev/null || true)
if [ "$have" = "$want" ]; then
	echo "$DAEMON_JSON already says so, nothing to do"
else
	if [ -n "$want" ]; then
		mkdir -p "$(dirname "$DAEMON_JSON")"
		# Through a temporary file: dockerd will not start on a half-written daemon.json.
		printf '%s\n' "$want" >"$DAEMON_JSON.tmp"
		mv "$DAEMON_JSON.tmp" "$DAEMON_JSON"
	else
		rm -f "$DAEMON_JSON"
	fi
	systemctl reload docker
	echo "$DAEMON_JSON rewritten, dockerd reloaded"
fi
echo "registry mirrors now: $(docker info --format '{{.RegistryConfig.Mirrors}}')"

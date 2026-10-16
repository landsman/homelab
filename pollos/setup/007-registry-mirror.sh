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
# Safe to re-run: it sets the one key in /etc/docker/daemon.json and keeps every other key, and
# reloads dockerd only when the file changed. A reload applies `registry-mirrors` without restarting
# a single container, the runner included.
#

DAEMON_JSON=${DAEMON_JSON:-/etc/docker/daemon.json}
MIRROR=${MIRROR:?set MIRROR to the cache URL, https://<nas>.<tailnet>.ts.net:5000, or to off}

case "$MIRROR" in
off | https://*) ;;
*)
	echo "MIRROR must be an https:// URL or off, got: $MIRROR" >&2
	exit 1
	;;
esac

# Prints `changed` or `unchanged`. Writes through a temporary file, so a failure never leaves a
# half-written daemon.json behind — dockerd refuses to start on one that does not parse.
result=$(
	python3 - "$DAEMON_JSON" "$MIRROR" <<'PY'
import json, os, sys

path, mirror = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        text = f.read()
    config = json.loads(text) if text.strip() else {}
except FileNotFoundError:
    config = {}
before = dict(config)
if mirror == "off":
    config.pop("registry-mirrors", None)
else:
    config["registry-mirrors"] = [mirror]
# No file and nothing to put in one is unchanged too: `off` on a fresh box writes no `{}`.
if config == before and (os.path.exists(path) or not config):
    print("unchanged")
    sys.exit(0)
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path + ".tmp", "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
os.replace(path + ".tmp", path)
print("changed")
PY
)

if [ "$result" = changed ]; then
	systemctl reload docker
	echo "$DAEMON_JSON updated, dockerd reloaded"
else
	echo "$DAEMON_JSON already says so, nothing to do"
fi
echo "registry mirrors now: $(docker info --format '{{.RegistryConfig.Mirrors}}')"

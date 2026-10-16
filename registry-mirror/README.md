# registry-mirror

A pull-through cache of Docker Hub on the NAS, for the boxes that pull images, the CI runners
first ([#451](https://github.com/landsman/homelab/issues/451)). An image pulled in the last week
comes from here, so a job does not need Docker Hub, or DNS that reaches it, to get it. A CI image
build once failed on its first line because the runner could not resolve `registry-1.docker.io`.

    make up      # start it and publish it on the tailnet, https on port 5000
    make size    # how much it holds

## Using it on a box

On the box, as root:

    MIRROR=https://<nas>.<tailnet>.ts.net:5000 pollos/setup/007-registry-mirror.sh

From then on Docker asks the cache first for every Docker Hub image: `docker pull`, `FROM` in a
build, the parser named by `# syntax=` in a Dockerfile, Testcontainers. When the cache does not
answer, Docker goes to Docker Hub itself. Two limits:

- **Docker Hub only.** `registry-mirrors` covers no other registry, so images from ghcr.io,
  docker.gitea.com or code.forgejo.org still come from there (the second half of #451).
- **The `docker` builder only.** A buildx builder with the `docker-container` driver runs its own
  BuildKit, which does not read the daemon's mirrors.

## Where the data is

In `./data` next to this file, which on the NAS is
`/mnt/raid0/containers/apps/registry-mirror/data`, on the array. `MIRROR_DATA` in `.env` puts it
anywhere else.

Everything cached is deleted 7 days after it was fetched from Docker Hub, used or not, and fetched
again on the next pull (`REGISTRY_PROXY_TTL` in [compose.yml](compose.yml)). The directory
therefore holds what the boxes pulled in the last week, not everything they ever pulled.

## Moving it

It is a cache, so a move needs no copy:

1. `make down`
2. `MIRROR_DATA=/path/on/the/new/disk` in `.env`
3. `make up`

The first pull of each image then comes from Docker Hub again. To keep it warm, `rsync -a` the old
directory to the new one between steps 1 and 3; the expiry schedule is in it too
(`scheduler-state.json`).

To another box: run this stack there and re-run `007-registry-mirror.sh` with the new URL on every
box that uses it. Nothing else names the cache.

## When Docker Hub is down

Checked with registry 3.1.2 on 2026-10-16, with a second registry standing in for Docker Hub and
stopped after the cache had started:

- an image already cached still pulls, and its tag answers 200;
- an image never cached answers 404, and Docker then tries Docker Hub itself.

Starting is different. The registry asks Docker Hub for `/v2/` once at start and exits if that
fails, so a NAS that boots during a Docker Hub or DNS outage has no cache until the restart policy
brings it up afterwards. The boxes pull from Docker Hub directly meanwhile.

## Checking it works

- `curl -s https://<nas>.<tailnet>.ts.net:5000/v2/_catalog` lists the repositories it holds, after
  a box has pulled through it.
- `make down`, and a CI job still pulls and passes, from Docker Hub.
- `make size` a week later is about what a week of pulls needs, and stays there.

## Ports

- `5000` — the registry, bound to `127.0.0.1`. `tailscale serve` publishes it on the tailnet as
  https on `5000`. Not on `443`: `/v2` there is Forgejo's registry ([../forgejo](../forgejo)).

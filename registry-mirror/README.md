# registry-mirror

Pull-through caches on the NAS for every registry the boxes pull images from, the CI runners first
([#451](https://github.com/landsman/homelab/issues/451)). An image pulled in the last week comes
from here, so a job does not need the registry, or DNS that reaches it, to get it. A CI image build
once failed on its first line because the runner could not resolve `registry-1.docker.io`.

All of them sit behind one address, `https://<nas>.<tailnet>.ts.net/mirror/<registry>`:

| Registry | Pulled for |
|---|---|
| Docker Hub (`docker.io`) | most images, `# syntax=` in a Dockerfile, Testcontainers |
| `ghcr.io` | Renovate, the semgrep mirror |
| `docker.gitea.com` | `runner-images`, the image every CI job runs in |
| `code.forgejo.org` | the Forgejo runner |

    make up      # start them and publish them on the tailnet
    make size    # how much each one holds

Behind the address there is one `registry` per upstream, because a registry proxies exactly one.
`tailscale serve` is the router: it maps `/mirror/<registry>` on the NAS's port 443 to that cache's
local port and strips the path, so each cache sees the `/v2/…` it expects. Forgejo's own `/v2` on
the same port is untouched.

A registry is a new service in [compose.yml](compose.yml), an entry in `SERVE` in the
[Makefile](Makefile) and a line in the table in `pollos/setup/007-registry-mirror.sh`.
`git.insuit.cz` is not one: it runs on this NAS already.

## Using it on a box

On the box, as root:

    NAS=<nas>.<tailnet>.ts.net pollos/setup/007-registry-mirror.sh

It writes `/etc/docker/certs.d/<registry>/hosts.toml` for each registry above, naming
`https://<nas>/mirror/<registry>` as its mirror; Docker appends the `/v2` itself. Docker reads those
on every pull and every build, so nothing restarts: `docker pull`, `FROM`, the parser named by
`# syntax=`, Testcontainers, and the runner pulling a job's image all go to the cache first. When
the cache does not answer, Docker goes to the registry itself. Two limits:

- **Docker's containerd image store only**, which jesse and walter use. The classic store pulls
  without reading `hosts.toml`, and the script refuses to run there.
- **The `docker` builder only.** A buildx builder with the `docker-container` driver runs its own
  BuildKit, which reads neither.

## Where the data is

In `/mnt/raid0/containers/cache/registry-mirror/<registry>` on the NAS: the layers and manifests
of every image the boxes pulled, as the registry stores them (`docker/registry/v2/…`). It is
other people's images and disposable, so it sits apart from the app's own files in
`containers/apps` and from Docker's in `containers/docker`, under a `cache` directory that is
never backed up. Deleting it costs one download per image. `MIRROR_DATA` in `.env` puts it
anywhere else.

The boxes keep their own copy of each image they pulled, in their own Docker, as before; the cache
does not change that.

Everything cached is deleted 7 days after it was fetched from upstream, used or not, and fetched
again on the next pull (`REGISTRY_PROXY_TTL`). So the directories hold what the boxes pulled in the
last week, not everything they ever pulled. Renovate alone is about 2 GB per version.

## Moving it

They are caches, so a move needs no copy:

1. `make down`
2. `MIRROR_DATA=/path/on/the/new/disk` in `.env`
3. `make up`

The first pull of each image then comes from upstream again. To keep them warm, `rsync -a` the old
directory to the new one between steps 1 and 3; the expiry schedule is in it too
(`scheduler-state.json`).

To another box: run this stack there and re-run `007-registry-mirror.sh` with its name on every box
that uses it. Nothing else names the caches.

## When something is down

Checked on 2026-10-16 with registry 3.1.2 and a Docker 29.8.1 on the containerd image store, the
version the runners run:

- **Through one address:** with the caches behind `/mirror/<registry>` on one port, and nginx
  stripping the path as `tailscale serve` does, `docker pull` from Docker Hub and ghcr.io and a
  build with `# syntax=` and a ghcr.io `FROM` each went to the right cache.
- **The upstream is down after a cache started:** an image it holds still pulls, its tag answering
  200. One it never held answers 404, and Docker goes to the registry itself.
- **A cache is down:** Docker goes to the registry itself; the pull took 1 s longer.
- **The upstream is down when a cache starts:** the registry asks it for `/v2/` once and exits, so
  that cache is missing until the restart policy brings it up afterwards. The boxes pull from the
  registry directly meanwhile.

A tag is still asked of the upstream on every pull, to see whether it moved; the cache answers it
only when the upstream does not. So a pull keeps working through an outage of anything it has
pulled in the last week, but it is not offline.

## Checking it works

- `curl -s https://<nas>.<tailnet>.ts.net/mirror/ghcr.io/v2/_catalog` lists the repositories a
  cache holds, after a box has pulled through it.
- `make down`, and a CI job still pulls and passes, from the registries themselves.
- `make size` a week later is about what a week of pulls needs, and stays there.

## Ports

- `5000` to `5003` — the caches, bound to `127.0.0.1` and reachable only through `tailscale serve`.
- `443` (tailnet) — `/mirror/<registry>`, next to Forgejo's `/v2` ([../forgejo](../forgejo)).

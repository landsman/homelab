# forgejo-runner

Forgejo Actions runner for [git.insuit.cz](https://git.insuit.cz), running on
`jesse.pollos` (x86 Debian 13) as a dedicated CI box. Job containers run natively
as `amd64`; cross-arch image builds fall back to QEMU.

The runner is a single container sharing the host Docker socket (`automount`),
so workflow jobs can run `docker buildx` against the box's own daemon — no dind.
It runs non-root (`1001`), reaching the socket via the host `docker` group gid.

## Setup on a fresh box

1. `make rsync` — pushes this dir (incl. the example config) to
   `jesse.pollos:forgejo-runner/`
2. On the box, once: `make config` — copies `runner/config.example.yml` →
   `runner/config.yml` (existing config is kept)
3. Edit `runner/config.yml` on jesse, filling the **UUID** and **Token** from
   Forgejo UI → **Settings → Actions → Runners → Create new runner**
   into `server.connections.forgejo` (`url` uses the publicly reachable
   `https://git.insuit.cz/`).
4. `make prepare` — one-time: owns `data/` for uid `1001` and writes `.env`
   with the docker group gid
5. `make up`
6. Verify the runner shows **online** in the Forgejo UI.
7. One-time, for cross-arch image builds: `make qemu`

`runner/config.yml`, `.env` and `data/` are gitignored — the token and socket
gid never land in the public `homelab` repo.

## Operations

```sh
make rsync        # push changes to the box (after editing config, eg. capacity)
ssh jesse.pollos 'cd forgejo-runner && make logs'    # follow runner logs
ssh jesse.pollos 'cd forgejo-runner && make status'
```

## Labels

| Label           | Execution       | Image                                          |
|-----------------|-----------------|------------------------------------------------|
| `ubuntu-latest` | Docker via host socket | `docker.gitea.com/runner-images:ubuntu-22.04` |
| `self-hosted`   | Host shell      | —                                             |

The label image is the Gitea project's runner image (built on the catthehacker
`act` base, org-maintained and version-pinned); `force_pull: true` keeps the job
image refreshed.

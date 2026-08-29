# forgejo-runner

Forgejo Actions runner for [git.insuit.cz](https://git.insuit.cz), running on
`jesse.pollos` (x86 Debian 13) as a dedicated CI box. Job containers run natively
as `amd64`; cross-arch image builds fall back to QEMU.

The runner is a single container sharing the host Docker socket (`automount`),
so workflow jobs can run `docker buildx` against the box's own daemon — no dind.
It runs non-root (`1001`), reaching the socket via the host `docker` group gid.

## Setup on a fresh box

1. `cp runner/config.example.yml runner/config.yml`
2. Forgejo UI → **Settings → Actions → Runners → Create new runner**, copy the
   **UUID** and **Token** into `runner/config.yml` → `server.connections.forgejo`
   (`url` uses the publicly reachable `https://git.insuit.cz/`).
3. `make rsync` — pushes this dir to `jesse.pollos:forgejo-runner/`
4. `ssh jesse.pollos 'cd forgejo-runner && make prepare'` — one-time: owns
   `data/` for uid `1001` and writes `.env` with the docker group gid
5. `ssh jesse.pollos 'cd forgejo-runner && make up'`
6. Verify the runner shows **online** in the Forgejo UI.
7. One-time, for cross-arch image builds:
   `ssh jesse.pollos 'cd forgejo-runner && make qemu'`

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

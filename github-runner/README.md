# Self-hosted GitHub runner

Long-lived GitHub Actions self-hosted runner for Raspberry Pi 5 (ARM64).

One `custom-runner-nodejs` container per repository registers with GitHub and stays up, taking one job after another.
**No runner software is installed on the Pi itself — only Docker is required**.

## What's inside the image

- [`myoung34/github-runner`](https://github.com/myoung34/docker-github-actions-runner) — base runner image with ARM64 support
- [Node.js](https://nodejs.org) 22 — for `npx` / Sentry CLI
- [Deno](https://deno.land) for Deno tasks
- [Supabase CLI](https://github.com/supabase/cli) — latest ARM64 binary
- `postgresql-client` — `psql` for Supabase Vault secret upserts in CI
- `shellcheck` — shell script linter for `make qa` (dashboard deploy scripts)

## Prerequisites

- Raspberry Pi 5 with Docker installed

## Setup

**1. Configure environment**

```bash
cp .env.example .env
# Edit .env and fill in REPO_URLs and GITHUB_TOKEN
```

Generate a **classic PAT** for `GITHUB_TOKEN` ([docs](https://github.com/myoung34/docker-github-actions-runner/wiki/Usage)):

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token**
3. Check `repo` and `workflow` scopes
4. Click **Generate token** and paste it into `.env`

> The container uses this PAT to call the GitHub API and generate a fresh runner registration token on every restart — so a long-lived PAT is required, not the short-lived token from the Actions runner UI.

**2. Build and run**

```bash
make build
make up
make logs
```

## GitHub workflow configuration

In any workflow you want to run on this runner, set:

```yaml
jobs:
  deploy:
    runs-on: [self-hosted, pi5]
```

## How it works

```
Pi (Docker only)
  └─ container starts
       └─ registers with GitHub, holds a long poll
            └─ picks up a job → runs → waits for the next one
  └─ Compose restarts the container only if it exits
```

### Why the runner is not ephemeral

`EPHEMERAL=true` makes the runner deregister and exit after every single job, so Compose
recreates the container each time. That is a clean workspace per run, and it was the original
setup — but on rootless Docker every recreate is another chance for the daemon to fail
unmounting the old rootfs. Enough of those and the container is left in `Dead` state, where
`docker compose up` refuses to start it (`container is marked for removal`) and only a
manual `docker rm -f` recovers it. Two runners reached that state after roughly two months.

Ephemeral runners are also the ones affected by
[actions/runner#1887](https://github.com/actions/runner/issues/1887), where the runner stays
`Idle` but silently stops accepting dispatched jobs.

The cost of dropping it is that `_work` persists between jobs. `actions/checkout` cleans the
repository itself, and for build-and-push jobs the leftover Docker layer cache is a speedup,
not a hazard. If a job ever needs a guaranteed-clean tree, give it its own container step
rather than turning ephemeral back on.

Because the runner now lives for weeks rather than minutes, `DISABLE_AUTO_UPDATE=true` matters
more: the runner version is pinned in the `Dockerfile` (`BASE_IMAGE`), so updating it means
bumping that pin and running `make restart`. GitHub eventually refuses connections from runners
that are too far behind, so do not let the pin drift.

### Why the container starts as root

`RUN_AS_ROOT=false` in `compose.yml` means jobs run as the `runner` user. The container still
*starts* as root, because the entrypoint has to: it reads the GID of the mounted docker socket,
`groupmod`s the docker group onto it, then drops privileges. A `USER` line in the Dockerfile
skips that and the runner loses the docker socket.

Trivy flags the missing `USER` as DS-0002 and cannot see any of the above, so the check is
excepted in [`.trivyignore`](.trivyignore) — scoped to this Dockerfile, with the reasoning in the
file. Note also that the daemon is rootless, so uid 0 inside the container is host uid 1001, not
root; see [../docker/README.md](../docker/README.md).

## Surviving `docker system prune`

A runner is briefly stopped whenever it is restarted or its image is rebuilt, so a raw `docker system prune` can sweep it mid-cycle. Both runner services carry the `preserve=true` label in `compose.yml`, which is honored by:

- The scheduled cleanup — `../docker/Makefile` `prune` target passes `--filter "label!=preserve=true"`
- Interactive shells — install [`../docker/docker-prune-guard.sh`](../docker/docker-prune-guard.sh) via `make -C ../docker guard-install` to wrap `docker system prune` / `docker container prune` with the same filter

Without one of these in place, ad-hoc prune commands will delete the runner containers.

## Scaling to multiple repositories

By default the runner is scoped to a single repository (`RUNNER_SCOPE=repo`). To cover additional repos you would need one Compose service per repository, each with its own `REPO_URL`.

The cleaner alternative is to create a free **GitHub Organization**, register the runner at org scope (`RUNNER_SCOPE=org`), and point all your repos there. A single service then handles jobs from every repo in the org — no duplication needed.

```yaml
# org-level example
environment:
  RUNNER_SCOPE: org
  ORG_NAME: your-github-org   # instead of REPO_URL
  GITHUB_TOKEN: ${GITHUB_TOKEN}  # needs org admin scope
  LABELS: self-hosted,pi5
```

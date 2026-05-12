# Self-hosted GitHub runner

Ephemeral GitHub Actions self-hosted runner for Raspberry Pi 5 (ARM64).

Each job spawns a fresh `custom-runner-nodejs` container that registers with GitHub, runs the job, and exits. 
**No runner software is installed on the Pi itself — only Docker is required**.

## What's inside the image

- [`myoung34/github-runner`](https://github.com/myoung34/docker-github-actions-runner) — base runner image with ARM64 support
- [Node.js](https://nodejs.org) 22 — for `npx` / Sentry CLI
- [Deno](https://deno.land) for Deno tasks
- [Supabase CLI](https://github.com/supabase/cli) — latest ARM64 binary
- `postgresql-client` — `psql` for Supabase Vault secret upserts in CI
- `shellcheck` — shell script linter for `make qa` (welcome-page deploy scripts)

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
       └─ registers with GitHub as ephemeral runner
            └─ picks up one job → runs → deregisters → exits
  └─ Compose restarts the container → repeat
```

The `EPHEMERAL=true` env var tells the runner to deregister itself after a single job, ensuring a clean environment for every run.

## Surviving `docker system prune`

Ephemeral runners briefly enter "stopped" state between jobs, so a raw `docker system prune` will sweep them mid-cycle. Both runner services carry the `preserve=true` label in `compose.yml`, which is honored by:

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
  EPHEMERAL: "true"
```

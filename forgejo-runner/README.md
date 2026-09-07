# forgejo-runner

Forgejo Actions runner for [git.insuit.cz](https://git.insuit.cz), running on
`jesse.pollos` (x86 Debian 13) as a dedicated CI box. Job containers run natively
as `amd64`; cross-arch image builds fall back to QEMU.

The runner is a single container sharing the host Docker socket (`automount`),
so workflow jobs can run `docker buildx` against the box's own daemon — no dind.
It runs non-root (`1001`), reaching the socket via the host `docker` group gid.

## Actions come from this instance

`uses:` is resolved at the start of every job, before its first step, and there is
no runner-side cache for the fetched code. So a workflow with eight jobs made
about ten round trips to somebody else's server on every run, and one of them has
already timed out for no reason anyone could reconstruct afterwards.

The actions are mirrored under `tools-mirror` on `git.insuit.cz` and workflows
point there:

| Action | Origin | Fetched from |
|--------|--------|--------------|
| `checkout@v7` | `github.com/actions/checkout`, mirrored by `code.forgejo.org` | `git.insuit.cz/tools-mirror/checkout` |
| `upload-artifact@v5` | `code.forgejo.org/forgejo/upload-artifact` (a fork — see CAVEATS) | `git.insuit.cz/tools-mirror/upload-artifact` |

```yaml
- uses: https://git.insuit.cz/tools-mirror/checkout@v7
```

Worth being precise about what this buys, because the obvious phrasing is wrong:
the dependency was never on github.com or codeberg.org directly. Actions resolve
against `DEFAULT_ACTIONS_URL`, which is `data.forgejo.org` — Forgejo's own host —
and Codeberg carries Forgejo's *source*, not its actions. What the mirrors remove
is a build depending on any host outside the LAN at all, including that one.

Two rules for adding another:

- **It has to be public on the instance.** The automatic token reads the
  repositories associated with the workflow, not an unrelated private one, and the
  runner fetches an action with a plain `git fetch` carrying no credentials. A
  private mirror fails with an authentication error, not a helpful one. There is
  nothing to protect in a copy of a public action.
- **Check the tag resolves to the same commit as upstream** before pointing a
  workflow at the copy. `git ls-remote <mirror> <tag>` against the same on the
  origin; a mirror is a copy, and a copy can be wrong or stale.

Nothing else is mirrored, so a workflow reaching for an action not in that table
still goes out to the WAN. `actions/setup-java` and `jdx/mise-action` are not
mirrored *anywhere* — not even by Forgejo — which is why a JVM job installs its
toolchain with a script instead of an action.

## Caveats

Known limitations and gotchas of Forgejo's registry/package and Actions
behavior are collected in [CAVEATS.md](CAVEATS.md) — read it before wiring up
image CI on this instance.

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

| Label           | Execution              | Where a step actually runs                    |
|-----------------|------------------------|-----------------------------------------------|
| `ubuntu-latest` | Docker via host socket | `docker.gitea.com/runner-images:ubuntu-22.04` |
| `self-hosted`   | `:host`                | *inside the runner container* — see below     |

**Use `ubuntu-latest` for everything.** The label image is the Gitea project's
runner image (built on the catthehacker `act` base, org-maintained and
version-pinned); `force_pull: true` keeps the job image refreshed. It carries
node, the docker client, make, curl, python3, sudo and apt.

`self-hosted` is mapped `self-hosted:host`, and "host" does not mean this box.
It forks a shell from the runner *process*, and that process is itself a
container — so a step lands inside `forgejo/runner:13`, which is Alpine with git,
bash and coreutils and nothing else. No node, so no JavaScript action runs there
(`actions/checkout` fails with `Cannot find: node in PATH`); no docker client, no
make, no curl, no JDK. It is almost never what a workflow wants, and the name
suggests otherwise, which is how the mistake gets made.

Forgejo matches a job by `runnerLabels.IsSubset(job.RunsOn)`, so `runs-on` takes
**one** of these names and never a list. A GitHub-style
`runs-on: [self-hosted, linux, x64]` matches no runner here, and an unmatched job
queues indefinitely rather than failing — which is the worst way to find out.

Workflow-authoring gotchas that follow from this layout — the job container's
filesystem and network, which actions work, which CLIs do not — are in
[CAVEATS.md](CAVEATS.md).

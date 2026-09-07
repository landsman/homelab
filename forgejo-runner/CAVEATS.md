# Forgejo caveats

> **Warning:** Forgejo has **no repo- or package-scoped `package` permission**.
> A token limited to a repository list can never carry `package`, and any
> package-scoped (or all-resources `read:package`) token reaches every package
> the owning account can read across all owners. Wait for
> [forgejo/forgejo#12573](https://codeberg.org/forgejo/forgejo/issues/12573)
> before assuming credentials can be scoped down to a single image; until then,
> account membership is the only isolation knob.

Hard-won notes for the homelab Forgejo instance and its Actions runner. First
discovered while wiring a private container-image CI pipeline.

## Token / package scoping — the big one

- Package tokens are **owner-scoped**, not repo- or package-scoped. A token
  limited to a repository list can only carry `read:issue, write:issue,
  read:repository, write:repository` — never `package`.
- Consequently there is **no repo-limited or package-limited pull token** for
  the container registry. The tracked feature request is
  [forgejo/forgejo#12573](https://codeberg.org/forgejo/forgejo/issues/12573)
  (package registry tokens); related discussion:
  [forgejo/forgejo#13051](https://codeberg.org/forgejo/forgejo/issues/13051).
- Workaround today: a dedicated account (bot) whose only membership is the
  private org, with an all-resources `read:package` token — isolation comes
  from the account's reach, not the token's scope. Requires an admin to create
  the account. Otherwise a full-scope `read:package` token reads every package
  the owning account can read.

## Registry auth when pushing from Actions

- The automatic `forgejo.token` **cannot push packages**
  (`401 Unauthorized: reqPackageAccess`).
- The workflow `permissions:` block is **ignored** by Forgejo 16.
- Authorized Integration: capabilities limited to a repository list can only
  enable `read:issue / write:issue / read:repository / write:repository`.
  Enabling `package` requires **"Allow access to all resources"**.
- Since 16.0.1 the container registry accepts an authorized-integration JWT in
  the `docker login` password field
  ([forgejo/forgejo#12310](https://codeberg.org/forgejo/forgejo/pulls/12310)).
  On earlier versions only real account credentials (PAT) work for
  `docker login`.
- Fetch the JWT from `$ACTIONS_ID_TOKEN_REQUEST_URL` with
  `audience=<integration Audience>` (`enable-openid-connect: true` in the
  workflow). The audience is not confidential — keep it in a repo
  **variable** (`vars.*`), not a secret.

## Package visibility follows the owner

- A package belongs to an owner (user or org), not a repository, and its
  visibility mirrors the owner's. A private repo with a public owner still
  ships **public** packages; Forgejo now warns about exactly this
  ([forgejo/forgejo#12627](https://codeberg.org/forgejo/forgejo/pulls/12627)).
- To ship a private image from a public account, push under a **private
  organization** — per-package/per-repo visibility does not exist.

## Actions cache is unreachable from the runner

- The Forgejo Actions cache server (NAS, `172.18.0.2:34795`) is not reachable
  from the runner host, so every `type=gha` cache round-trip stalls until its
  timeout — multi-minute stalls on first pulls. Avoid `cache-from` /
  `cache-to: type=gha` with this layout and let builds pull fresh.

## Cross-arch builds

- `docker/setup-qemu-action` also stalls on that cache-restore before
  registering binfmt. Instead register binfmt on the host once via
  `multiarch/qemu-user-static` (`make qemu` in this directory) and omit the
  setup-qemu step from workflows.

## Writing workflows against this runner

Everything below was measured on this layout, mostly while porting a JVM project's
CI over from GitHub Actions. Each one fails quietly rather than loudly, which is
what makes them worth writing down.

### `self-hosted` is not this box

Covered in the [README](README.md#labels), repeated here because it is the one
that costs the most time: `self-hosted:host` forks a shell from the runner
process, which is itself a container. Steps land inside `forgejo/runner:13` —
Alpine with git, bash and coreutils. No node (so **no JavaScript action runs**,
`actions/checkout` included), no docker client, no make, no curl, no JDK.

Check the image rather than trusting the label name:

```sh
docker run --rm --entrypoint sh code.forgejo.org/forgejo/runner:13 \
  -c 'for t in node docker make curl python3 java; do command -v $t || echo "$t MISSING"; done'
```

Use `ubuntu-latest`. If one job ever needs something the image lacks,
`jobs.<id>.container.image` overrides the label per job with no runner change —
cheaper than a bespoke runner image, and it keeps tool versions in the project
that uses them. Bear in mind each distinct image is another ~2.2 GB pull.

### The job container's filesystem is not the host's

`automount` shares the box's Docker socket with the job container, so a job can
drive the host daemon. It does **not** share a filesystem. The workspace is a
volume inside the job container, so a path like `$PWD` means nothing to the host
daemon, and

```yaml
- run: docker run --rm -v "$PWD:/src" some/scanner /src
```

mounts an **empty directory** into the sibling container. A scanner run that way
finds nothing and exits 0 — a green check that never had the code in front of it.

Give the sibling the job's own volumes instead:

```yaml
- run: docker run --rm --volumes-from "$(hostname)" -w "$PWD" some/scanner .
```

`docker build` is unaffected: the client streams its context to the daemon rather
than mounting it, so `docker build .` works untouched.

### The job container's network is not the host's

A container started from a job — anything Testcontainers spins up, for instance —
is a **sibling on the host**, so the port it publishes is bound on the host, not
on the job's own localhost. Testcontainers assumes localhost by default and hangs
until its timeout.

Measured from inside a job container, against a sibling published on `:18081`:

| Address                | Result       |
|------------------------|--------------|
| `localhost:18081`      | times out    |
| `<default gateway>:18081` | `200`     |

So export `TESTCONTAINERS_HOST_OVERRIDE` pointing at the default gateway. `ip` is
not in the runner image, hence `/proc/net/route`:

```sh
gateway=$(python3 -c "
import struct
for line in open('/proc/net/route').readlines()[1:]:
    f = line.split()
    if f[1] == '00000000':
        print('.'.join(str(b) for b in struct.pack('<L', int(f[2], 16)))); break
")
echo "TESTCONTAINERS_HOST_OVERRIDE=$gateway" >> "$GITHUB_ENV"
```

This is correct *because* the runner uses `automount`. Under dind, or a runner
executing on the box itself, the daemon would be local and this must not be set.

### `actions/upload-artifact` does not work past v3

The mirror's own repository description on `data.forgejo.org` says so: *"@v4 will
not work from this mirror."* Use the patched fork Forgejo itself uses —
`https://data.forgejo.org/forgejo/upload-artifact@v5`. Getting this wrong loses
artefacts precisely on the runs that failed, which is the only time they matter.

### `GITHUB_TOKEN` is a Forgejo token, and tools believe it

Forgejo publishes `GITHUB_TOKEN` as an alias of `FORGEJO_TOKEN`, so workflows
written against GitHub keep working. Any tool that reads `GITHUB_TOKEN` and
assumes it means github.com therefore authenticates a Forgejo token against the
GitHub API and gets `401 Bad credentials`.

mise is the one that caught us — it queries the GitHub releases API to resolve a
tool version:

```
mise WARN [evilmartians/lefthook] failed to fetch version tags:
  401 Unauthorized for url (https://api.github.com/repos/evilmartians/lefthook/releases)
  github auth: yes (token from GITHUB_TOKEN)
```

It half fails, which is what makes it look like a broken tool rather than a
broken token: tools served from somewhere other than GitHub install perfectly
(a JetBrains JDK off JetBrains' own CDN), while everything whose releases live on
GitHub dies. Expect the same from any release-fetching helper — `gh`, aqua, ubi,
installer scripts that read `GITHUB_TOKEN`.

Empty the variable for those steps, which restores the unauthenticated path:

```yaml
- run: |
    GITHUB_TOKEN="" ; export GITHUB_TOKEN
    echo "GITHUB_TOKEN=" >> "$GITHUB_ENV"   # for the steps after this one
```

`FORGEJO_TOKEN` is untouched and stays the one that talks to the instance.
Unauthenticated github.com is 60 requests an hour per IP, shared by every job on
this runner — if that starts biting, supply a real PAT under the tool's own
variable (`MISE_GITHUB_TOKEN` and friends) rather than putting the Forgejo token
back.

### `gh` does not talk to Forgejo

The GitHub CLI speaks the GitHub API, and `github.token` here is `FORGEJO_TOKEN`
— so a step lifted from a GitHub workflow authenticates a Forgejo token against
`api.github.com` and fails. These steps are usually failure handlers, so nobody
sees it. Use the instance API directly:

```sh
curl -fsSL -H "Authorization: token $FORGEJO_TOKEN" \
  "$GITHUB_SERVER_URL/api/v1/repos/$GITHUB_REPOSITORY/issues"
```

### Actions resolve against `DEFAULT_ACTIONS_URL`, not GitHub

`uses: actions/checkout@v7` is prefixed with `DEFAULT_ACTIONS_URL`, which is
`https://data.forgejo.org/` and is administrator-configurable. Write the full URL
so the workflow says which registry it means, and read the available tag *there*
rather than carrying GitHub's across:

```sh
curl -s "https://data.forgejo.org/api/v1/repos/actions/checkout/tags?limit=50" | jq -r '.[].name'
```

### Nice-to-haves that GitHub lacks

- `on.schedule` takes an IANA `timezone:` next to the `cron:`, so a nightly does
  not drift an hour with summer time. Avoid scheduling into the DST switch hour:
  a run in the hour that is skipped never happens, and one in the hour that
  repeats runs twice.
- There is no "scheduled workflows are disabled after 60 days of inactivity"
  behaviour to work around.

### Renovate replaces Dependabot, and needs a real account

Forgejo has no Dependabot, so a `dependabot.yml` here is a file nothing reads.
Renovate is the replacement, and unlike Dependabot it is not a service the forge
runs — something has to invoke it, so it wants a scheduled workflow of its own.

There is nothing to sign up to: the token is a personal access token minted on
this instance (Settings → Applications). Per Renovate's Forgejo platform docs the
scopes are `write:repository`, `read:user`, `write:issue` and `read:organization`
— user read because it calls `/user` to work out who it is.

Mint it on a **bot account**, not a person: every pull request is authored by
whoever owns the token, and Renovate wants that account to have a full name and
an email. The automatic `FORGEJO_TOKEN` cannot stand in — it belongs to the
`forgejo-actions` system user, which has neither, and a branch pushed with it is
the usual way to end up with dependency pull requests that no CI runs on.

## Parallel runs

- The runner runs with `capacity: 2`; independent triggers execute concurrently
  (expensive the first time: ~2.2 GB of runner images per job). Prefer a
  workflow-level `concurrency:` group over lowering runner capacity.
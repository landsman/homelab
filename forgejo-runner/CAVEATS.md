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

## Parallel runs

- The runner runs with `capacity: 2`; independent triggers execute concurrently
  (expensive the first time: ~2.2 GB of runner images per job). Prefer a
  workflow-level `concurrency:` group over lowering runner capacity.
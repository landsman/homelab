# forgejo-mcp caveats

What bites when running, upgrading or using this server. What Forgejo's API itself cannot
do — resolving a review thread, replying in one — is in
[forgejo/CAVEATS.md](../forgejo/CAVEATS.md); no MCP server can add it. The login side is
in [authelia/CAVEATS.md](../authelia/CAVEATS.md).

## The signing key

Whoever holds `secrets/signing.pem` signs JWTs Forgejo accepts for every person whose
integration trusts this server. Upstream logs a warning about it at every start.

- **Rotation without downtime** takes two restarts and a wait: Forgejo caches the key set
  for ten minutes and does not refetch on an unknown key. The steps are upstream's,
  [Keys and rotation](https://git.b4mad.industries/agentic-forges/forgejo-mcp/src/branch/main/docs/oauth-resource-server/operator.md#keys-and-rotation).
- **After a suspected leak**, replace it and restart at once. Every call fails for up to
  ten minutes, until Forgejo's cache expires. Deleting the integrations stops the leaked
  key sooner.

## Forgejo has to reach it, and is told it may

Forgejo fetches `/issuer/…` when an integration is saved and when its key cache expires.
Two things must hold, or saving fails with "Issuer validation failed":

- `FORGEJO_MCP_HOST` in `../forgejo/.env`. The tailnet name resolves to 100.64/10, which
  Forgejo refuses by default, and listing it replaces that default for every integration
  on the instance.
- The forgejo container resolves and routes to the tailnet name. It goes through the
  Pi's own tailscaled; check with the `docker exec forgejo wget …` line in the README.

## The issuer URL is in every integration

`FORGEJO_MCP_FORGEJO_JWT_ISSUER` is derived from `FORGEJO_MCP_HOST`. Renaming the node
breaks every integration, and every client entry in `landsman/config`, and Forgejo's
allowed domain. Renaming the Pi ([homelab#392](https://github.com/landsman/homelab/issues/392))
does not touch this, but does the `nas` lookup in `pollos/infra/tailscale.tf`, which then
fails the plan.

## It will not start without Authelia

At startup the server fetches Authelia's discovery document and refuses to start if it
does not answer or names another issuer — byte for byte, trailing slash included. A
stopped Authelia shows in `make logs` as a restart loop. Start Authelia first.

## A sidecar that lost its state needs a new key

The auth key is single-use, and expires after 90 days unused; the node itself does not
expire, because a tagged node's key expiry is off. Deleting the `tailscale` volume, or removing the node in the
admin console, leaves the sidecar unable to log in again: apply a new key
(`terraform apply -replace=tailscale_tailnet_key.forgejo_mcp` in `pollos/infra`), put it in
`.env`, `make up`.

## An upgrade builds from the mirror, not from upstream

Upstream's image is linux/amd64 only, so `compose.yml` builds from the tag on
`git.insuit.cz/tools-mirror/forgejo-mcp`. Renovate watches upstream
(`git.b4mad.industries`), so a bump can name a tag the mirror has not synced yet, and the
build fails on a missing ref. The seven-day `minimumReleaseAge` usually covers it; if not,
sync the mirror (its settings page, or `POST /repos/tools-mirror/forgejo-mcp/mirror-sync`).

A merged bump is not deployed: there is no checkout on the Pi. Copy `compose.yml` to
`~/containers/apps/forgejo-mcp/` and run `make build up`.

## A run number is not a run id

A run URL, `…/actions/runs/1660`, carries the run's number. `get_workflow_run` and
`list_action_run_jobs` take its internal id, and the two drift apart. Look the number up
with `list_workflow_runs`, which prints both, first.

## File-path uploads stay off

`FORGEJO_MCP_ALLOW_FILE_PATH_UPLOAD` lets attachment tools upload files from the server's
filesystem — here, the Pi's. It stays unset.

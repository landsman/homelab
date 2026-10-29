# forgejo-mcp caveats

What bites when running, upgrading or using this server. What Forgejo's API itself cannot
do — resolving a review thread, replying in one — is in
[forgejo/CAVEATS.md](../forgejo/CAVEATS.md); no MCP server can add it.

## Reaching the endpoint is the credential

`FORGEJO_MCP_ALLOW_OPERATOR_TOKEN_FALLBACK=true` runs every request without an
`Authorization` header as the bot. So:

- **Never publish a port.** The pollos boxes share the Pi's LAN, and jesse runs arbitrary
  CI jobs.
- **Never put it behind a Cloudflare tunnel.** It has no authentication of its own.
- **Never move it back to a path on the Pi's `tailscale serve`.** The runner needs the
  Pi's 443, and an ACL cannot filter by path — that is why it is a node of its own.
- **Never let `tag:pollos` reach `tag:forgejo-mcp`**, nor widen the ACL back to `* → *:*`.

## A bad token is a restart loop

The server checks the token against Forgejo at startup and exits 1 if it is rejected. A
revoked or mistyped token shows in `make logs` as the container restarting, not as tools
failing one by one.

## The node name is in every client

`FORGEJO_MCP_ALLOWED_HOSTS` must be the tailnet name clients use: the server refuses any
other `Host`, against DNS rebinding. Renaming the `forgejo-mcp` node means a new value here
and a new URL in every client entry in `landsman/config`. Renaming the Pi
([homelab#392](https://github.com/landsman/homelab/issues/392)) does not touch this, but
does the `nas` lookup in `pollos/infra/tailscale.tf`, which then fails the plan.

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

## A token name is used once

Forgejo refuses a token name the account already has and can never print a token again.
`make token` names it by date, so a second run on the same day fails — remove that day's
token under the bot first. A new token does not revoke the old one.

## A run number is not a run id

A run URL, `…/actions/runs/1660`, carries the run's number. `get_workflow_run` and
`list_action_run_jobs` take its internal id, and the two drift apart. Look the number up
with `list_workflow_runs`, which prints both, first.

## File-path uploads stay off

`FORGEJO_MCP_ALLOW_FILE_PATH_UPLOAD` lets attachment tools upload files from the server's
filesystem — here, the Pi's. It stays unset.

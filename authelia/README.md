# Authelia

[Authelia](https://www.authelia.com/) is the login for [forgejo-mcp](../forgejo-mcp): coding
agents sign in here in a browser, and get the access token forgejo-mcp checks. It does
nothing else — no site is protected through it. How a call is authorised, end to end, is
the diagram in [forgejo-mcp's README](../forgejo-mcp/README.md#how-a-call-is-authorised).

Why Authelia, and what else was weighed: the brain's _OIDC provider for the Forgejo MCP_.
In short, forgejo-mcp needs JWT access tokens carrying a per-user claim only an admin can
set, and of the light providers Authelia is the one that issues them. Its own image runs on
arm64.

## What it issues

Per device, one public client, `forgejo-mcp-<device>` in
[`configuration.yml`](configuration.yml), with PKCE and the redirect
`http://localhost:53682/callback`:

- **access token**: a JWT signed RS256, one hour, `aud` = forgejo-mcp's `/mcp`, `sub` = the
  user's opaque subject, `forgejo_aud` = the audience of their Forgejo integration;
- **refresh token**: 90 days, a new one with each refresh. A device signs in again only
  after 90 days unused.

Login is a password and a second factor, a passkey or TOTP. The first login asks once to
allow the scopes.

`forgejo_aud` comes from `users.yml`, which lives on the Pi only and which no user can edit.
The Forgejo integration's rule `sub = <subject>` makes a wrong `forgejo_aud` useless anyway.

A new device: add a client in `configuration.yml`, `make up`, and its entry in
`landsman/config`. Removing a device: delete its client — see [CAVEATS.md](CAVEATS.md).

## Setup

On the Pi, in `~/containers/apps/authelia/`, after
[the tailnet change](../pollos/infra/TAILNET.md) is applied. The steps marked _laptop_ need
1Password, which is signed in there and not on the Pi; they reach the Pi over ssh, `<pi>` being
its ssh host.

1. **Bun**, for `make user` and `make integration`, installed the way the pollos boxes get it:
   [`pollos/setup/004-typescript.sh`](../pollos/setup/004-typescript.sh).
2. **`.env`**: `cp .env.example .env`, then fill it in. `TS_AUTHKEY` is printed by
   `make -s authelia-authkey` in `pollos/infra`, on a laptop; it is used once.
3. **Secrets**, made on the Pi and printed nowhere, then straight into 1Password from the
   laptop. The nightly backup leaves them out on purpose, so this copy is the only one:

   ```bash
   make secrets                                      # Pi
   make secrets-backup PI=<pi> VAULT=<vault>          # laptop, in authelia/
   ```

4. **Your login**, _laptop_: the password goes from 1Password to the Pi on ssh's stdin.

   ```bash
   op read 'op://<vault>/<item>/password' \
     | ssh <pi> 'cd containers/apps/authelia && make user USER=<name> EMAIL=<address>'
   ```

5. **Start it**, and the nightly backup:

   ```bash
   make up
   make cron-install
   ```

6. **Check the name.** The node is `auth`, unless the tailnet already had one; then it is
   `auth-1`. `tailscale status` or the admin console says which. If it differs from
   `AUTH_HOST` in `.env`, fix that and `make up` again.
7. **A passkey**: in a browser, `https://auth.<tailnet>.ts.net`, sign in, register one. The
   one-time code it asks for is not mailed; `make code` prints it.
8. **Once [forgejo-mcp](../forgejo-mcp/README.md#setup) answers**, its Forgejo integration:

   ```bash
   make integration USER=<name>   # creates the Forgejo integration, writes forgejo_aud
   ```

Authelia picks the new `forgejo_aud` up by itself; tokens issued after that carry it.

The integration gets `read:user`, `write:repository` and `write:issue` on all the user's
repositories. Widen it (`SCOPES=…`) when a tool actually fails, not in advance.

## Backup

As readeck's: `make cron-install` once, and `make backup` runs every night at 3:30. It tars
the database and `users.yml` into `/home/containers/backup/authelia`, keeps 14 days, and
pauses Authelia for the second it takes. Copy that folder off the box from there.
`make restore FILE=…` puts one back. `secrets/` is not in it, it is in 1Password (step 3);
on a rebuilt Pi, `make secrets-restore PI=<pi> VAULT=<vault>` from the laptop first. See [CAVEATS.md](CAVEATS.md).

## Checks

`make test` type-checks `cli/user.ts` and runs its tests with docker stubbed out; CI runs it when a script in `cli/` changes.

The configuration was checked against the 4.39.28 image on 2026-10-29: `validate-config`,
then a local run with a login, the code exchange and a refresh for two clients, and one
client deleted, and a login with a `users.yml` written by `cli/user.ts`. Not yet against
forgejo-mcp itself or over the tailnet.

## Ports

None on the Pi. Authelia listens on 9091 inside the sidecar's network namespace, and the
sidecar serves it on 443 of its own tailnet node, `auth`.

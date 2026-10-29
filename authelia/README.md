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

On the Pi, in `~/containers/apps/authelia/`. `make user` and `make integration` run
`user.ts` with Bun, installed the way the pollos boxes get it
([`pollos/setup/004-typescript.sh`](../pollos/setup/004-typescript.sh)).

```bash
cp .env.example .env    # the tailnet names; TS_AUTHKEY from `make -s authelia-authkey` in pollos/infra
make secrets            # made here, printed nowhere; then copy secrets/ into 1Password
op read 'op://<vault>/<item>/password' | make user USER=<name> EMAIL=<address>
make up
```

Then, in a browser on a device, `https://auth.<tailnet>.ts.net`: sign in and register a
passkey. The one-time code it asks for is not mailed; `make code` prints it.

Then [forgejo-mcp](../forgejo-mcp/README.md#setup), and once it answers:

```bash
make integration USER=<name>   # creates the Forgejo integration, writes forgejo_aud
```

Authelia picks the new `forgejo_aud` up by itself; tokens issued after that carry it.

The integration gets `read:user`, `write:repository` and `write:issue` on all the user's
repositories. Widen it (`SCOPES=…`) when a tool actually fails, not in advance.

## Checks

`make test` type-checks `user.ts` and runs its tests with docker stubbed out; CI runs it on every change here.

The configuration was checked against the 4.39.28 image on 2026-10-29: `validate-config`,
then a local run with a login, the code exchange and a refresh for two clients, and one
client deleted, and a login with a `users.yml` written by `user.ts`. Not yet against
forgejo-mcp itself or over the tailnet.

## Ports

None on the Pi. Authelia listens on 9091 inside the sidecar's network namespace, and the
sidecar serves it on 443 of its own tailnet node, `auth`.

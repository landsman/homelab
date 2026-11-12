# Authelia caveats

What bites when running or upgrading the login for [forgejo-mcp](../forgejo-mcp).

## Refresh tokens and authelia#13390

A refresh token presented twice makes Authelia revoke the whole grant, and in 4.39.28 the
refreshes after that get `500` instead of `400 invalid_grant`
([authelia#13390](https://github.com/authelia/authelia/issues/13390), open). A client takes
a 500 as transient and retries rather than logging in again.

Claude Code refreshes under a file lock shared by its sessions on a device, and re-reads
the stored token first (read from 2.1.312), yet a grant still got revoked on 2026-11-12,
with some fifty sessions open on one laptop. Three of them still ran 2.1.310: a running
session keeps the binary it started with, whatever has been installed since. The likely
culprit, not proven. Its sessions then retried the dead token all day. Each device has its own client and its own grant, so the others were unaffected.

The fix is logging in again (`/mcp`, authenticate). That used to fail too: the retries
tripped the token endpoint's rate limit, which is per IP, and the fresh login's code
exchange got `429` for up to an hour. The limit is off for that endpoint now; it guarded
no secret, since every client is public with PKCE.

## Deleting a client is the way to cut a device off

There is no admin page that revokes one device's session. Each device has its own client in
`configuration.yml`; deleting it and restarting refuses that client's refresh tokens at
once (`invalid_client`, checked on 2026-10-29). Its last access token still works until it
expires, at most an hour, and only from the tailnet.

## The secrets are not rebuilt

`make secrets` writes what is missing, so a lost file is silently replaced by a new one:

- `storage` lost: the database cannot be read — the pinned `sub` of each user, and with it
  every Forgejo integration's rule, and the registered passkeys.
- `oidc.pem` lost: every token stops validating; every device logs in again.

Keep a copy of `secrets/` in 1Password. The nightly `make backup` holds the database and
`users/` but not `secrets/`, on purpose: the storage key beside the database it encrypts
would undo the encryption.

## users.yml is mounted as a folder

The container mounts `users/`, not `users/users.yml`. Authelia's watcher watches the
file's folder and filters by name; with the file mounted alone, that folder is the
container's own `/config`, which never hears of a write from the Pi, so a change waited
for a restart. With the folder mounted, an edit in place and a save by rename both reload.

Moving from the single-file mount, on the Pi, once:

```bash
cd ~/dev/apps/authelia && [ -e users/users.yml ] || { mkdir -m 700 -p users && mv users.yml users/; }
make up
```

## An env variable named AUTHELIA_… is configuration

Authelia reads every `AUTHELIA_*` variable as a configuration key. That is why the host
names are `AUTH_HOST` and `FORGEJO_MCP_HOST`: `AUTHELIA_HOST` was taken as the deprecated
`host` key and refused the start.

## A sidecar that lost its state needs a new key

As for forgejo-mcp: `terraform apply -replace=tailscale_tailnet_key.authelia` in
`pollos/infra`, put the key in `.env`, `make up`. Delete the old node in the admin console
first, or the new one is `auth-1`: a different issuer than the one forgejo-mcp and every
client expect, and no token Authelia issues is accepted.

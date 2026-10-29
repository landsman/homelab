# Authelia caveats

What bites when running or upgrading the login for [forgejo-mcp](../forgejo-mcp).

## Refresh tokens and authelia#13390

A refresh token presented twice makes Authelia revoke the whole grant, and in 4.39.28 the
refreshes after that get `500` instead of `400 invalid_grant`
([authelia#13390](https://github.com/authelia/authelia/issues/13390), open). A client takes
a 500 as transient and retries rather than logging in again.

Claude Code does not present one twice: it refreshes under a file lock shared by its
sessions on a device, and re-reads the stored token first (read from 2.1.312). Each device
has its own client and its own grant. A client without such a lock — opencode was not
checked — could trip it. The sign is a device that keeps failing until it logs in again;
deleting its stored token in the client and logging in fixes it.

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
`users.yml` but not `secrets/`, on purpose: the storage key beside the database it encrypts
would undo the encryption.

## users.yml is edited in place

The container mounts that one file, and a mount of a file keeps its inode: an editor that
saves by writing a new file and renaming it over the old one leaves Authelia reading the
old one. `cli/user.ts` writes in place; by hand, use `cat >` or restart Authelia after saving.

## An env variable named AUTHELIA_… is configuration

Authelia reads every `AUTHELIA_*` variable as a configuration key. That is why the host
names are `AUTH_HOST` and `FORGEJO_MCP_HOST`: `AUTHELIA_HOST` was taken as the deprecated
`host` key and refused the start.

## A sidecar that lost its state needs a new key

As for forgejo-mcp: `terraform apply -replace=tailscale_tailnet_key.authelia` in
`pollos/infra`, put the key in `.env`, `make up`.

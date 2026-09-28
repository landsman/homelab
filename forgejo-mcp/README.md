# Forgejo MCP server

[forgejo-mcp](https://git.b4mad.industries/agentic-forges/forgejo-mcp) gives coding
agents Forgejo's issues, pull requests, files and Actions runs as tools. It runs here,
next to [Forgejo](../forgejo), and agents reach it over the tailnet. Built from the
mirror at `git.insuit.cz/tools-mirror/forgejo-mcp`.

## Why it runs on the Pi and not on each laptop

The server needs a Forgejo token. When it ran as a local stdio process, that token
was exported into every shell, so any agent with a shell could print it. Moving it to
another user or into the Keychain on the same machine does not help: a process
running as that user can still read it.

Here, the token is in `.env` on the Pi and nowhere else. Clients connect to a URL and
send no credential. An agent can use what the token allows, through the tools, but
cannot read the token. It also covers every machine, Windows included, with no local
build.

If Tailscale is off, the server is absent. That is accepted.

## Who can reach it, and why that matters

`FORGEJO_MCP_ALLOW_OPERATOR_TOKEN_FALLBACK=true` makes a request with no
`Authorization` header run with this server's token. **So anything that can reach
the endpoint acts as that token.** Two layers keep that to your own devices:

- The port is published on `127.0.0.1` only. The pollos boxes share this LAN, and
  jesse runs arbitrary CI jobs.
- `tailscale serve` is the only way in. The tailnet ACL in
  [`pollos/infra/tailscale.tf`](../pollos/infra/tailscale.tf) lets `tag:pollos`
  reach only other pollos boxes.

Not behind a Cloudflare tunnel, unlike the other services: the endpoint has no
authentication of its own.

## Setup

```bash
cp .env.example .env   # set the tailnet name and the token
make up                # builds the image on first run
make serve             # publish on the tailnet
```

Create the token at `https://git.insuit.cz/user/settings/applications` with only
`read:user`, `write:repository` and `write:issue`. Widen it when a tool actually
fails, not in advance.

Clients use `https://nas.<tailnet>.ts.net/forgejo-mcp` as a streamable-HTTP MCP
server. The Claude Code and opencode entries are in `landsman/config`.

The server checks the token against Forgejo at startup and exits if it is rejected, so
a bad or revoked token shows up in `make logs` as a restart loop, not as tools that
fail one by one.

Upgrade: bump `FORGEJO_MCP_VERSION` in `.env`, then `make build up`.

`FORGEJO_MCP_ALLOW_FILE_PATH_UPLOAD` stays unset. It lets attachment tools upload
files from the server's filesystem, and here that is the Pi.

## Ports

| Port          | Container | Notes                                    |
|---------------|-----------|------------------------------------------|
| 8005          | 8080      | streamable HTTP, `127.0.0.1` only        |
| 443 (tailnet) | —         | `tailscale serve` `/forgejo-mcp` → 8005  |

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

- No port is published on the Pi. The server listens on the loopback of a
  Tailscale sidecar, which is its own tailnet node, `forgejo-mcp`, tagged
  `tag:forgejo-mcp`. The pollos boxes share the Pi's LAN, and jesse runs
  arbitrary CI jobs.
- The tailnet ACL in [`pollos/infra/tailscale.tf`](../pollos/infra/tailscale.tf)
  lets `tag:pollos` reach the Pi's 443, where the runner fetches mirrored actions
  and images, but not `tag:forgejo-mcp`. A path on the Pi's own `tailscale serve`
  could not be split off like that: an ACL does not see paths.

## Whose token

A bot account's, `michal`, not mine. Two reasons:

- **Reach.** My account is the instance's only site admin, so its token
  reaches every repository there. The bot reaches only the repositories it is a
  collaborator on, and branch protection keeps it off `main` like anyone else.
- **Revocation.** Its token goes without touching mine, and what it wrote is
  told apart from what I wrote by the author alone.

Its password is random and known to nobody: it exists to hold the token, like
the registry bots in [../forgejo](../forgejo/README.md#accounts-that-are-not-people).

Not behind a Cloudflare tunnel, unlike the other services: the endpoint has no
authentication of its own.

## Setup

```bash
cp .env.example .env   # set the tailnet name
make bot               # the account, if it is missing
make token             # its token, straight into .env
make up                # builds the image on first run
```

`TS_AUTHKEY` is needed for the first `make up` only, from
`make -s forgejo-mcp-authkey` in `pollos/infra`; the sidecar's state volume keeps
the node after that, so the key can be removed from `.env`.

Then add `michal` as a collaborator, with write, on the repositories agents
should work in — by hand, because which ones they are is mine to decide, not this
file's.

The token's scopes are `read:user`, `write:repository` and `write:issue`. Widen
them (`make token SCOPES=…`) when a tool actually fails, not in advance. Rotating
is `make token` again; the old token stays valid until it is removed.

Clients use `https://forgejo-mcp.<tailnet>.ts.net/mcp` as a streamable-HTTP MCP
server. The Claude Code and opencode entries are in `landsman/config`.

The server checks the token against Forgejo at startup and exits if it is rejected, so
a bad or revoked token shows up in `make logs` as a restart loop, not as tools that
fail one by one.

Upgrade: Renovate opens the bump; after merging, copy `compose.yml` to the Pi and
run `make build up`. What to know before that is in [CAVEATS.md](CAVEATS.md).

`FORGEJO_MCP_ALLOW_FILE_PATH_UPLOAD` stays unset. It lets attachment tools upload
files from the server's filesystem, and here that is the Pi.

## Ports

None on the Pi. The server listens on 8080 inside the sidecar's network
namespace, and the sidecar serves it on 443 of its own tailnet node.

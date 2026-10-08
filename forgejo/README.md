# Forgejo application

Self-hosted Git service running in Docker on Raspberry Pi.

- Source: https://codeberg.org/forgejo/forgejo
- MCP server: [../forgejo-mcp](../forgejo-mcp), on the tailnet
- iOS app: https://codeberg.org/secana/Forji
- Android app: https://codeberg.org/gitnex/GitNex

## Configuration

Set the required env variable values before starting:

```bash
cp .env.example .env
```

## Usage

```bash
make up                                           # start
make down                                         # stop
make logs                                         # follow logs
make backup                                       # run backup manually
make restore FILE=forgejo-backup-YYYYMMDD_HHMMSS.tar.gz
make cron-install                                 # register daily backup cron job (fails if already exists, run: crontab -l | grep forgejo)
make serve                                        # publish the registry on the tailnet, see below
```

## What this box publishes on the tailnet

`git.insuit.cz` resolves to Cloudflare, and two of Forgejo's clients are better off not going
through it. Both are published on this box's own tailnet name:

| Path | For | Why not through Cloudflare |
|---|---|---|
| `/v2` | the container registry | Cloudflare refuses a request body over 100 MiB and a registry push sends each layer as one request. Measured 2026-09-16: 100 MiB reached Forgejo (`401`), 101 MiB was refused (`413`), and a JVM app's dependency layer is 106 MiB — so a push cannot go through it at all |
| `/tools-mirror` | the mirrored actions the CI runner fetches | possible, but it is a trip to a Prague edge and back for a box two hops away, about ten times per run, and it has timed out twice. See [../forgejo-runner](../forgejo-runner) |

```bash
make serve         # publish both paths — `make up` does this too
make serve-status  # show the current serve config
make unserve       # stop publishing them
```

The mapping is kept by tailscaled itself, so it survives a restart of the daemon and of the box:
checked on 2026-09-30, the `/yt-archive` mapping made on 2026-05-04 was still up after tailscaled
had restarted two days earlier. `make up` re-applies it regardless, so a rebuilt box needs nobody to
remember this page.

`https://<host>.<tailnet>.ts.net/v2/` then answers `401`, the same as `http://<host>:3000/v2/` does
on the LAN. Like yt-archive, this needs the one-time `sudo tailscale set --operator=containers`.

### Why not a `tailscale` container in the compose file

It would be the tidier shape on paper: the serve config as a file the container applies at start,
no dependency on the host's tailscaled or on the operator grant, and a name of its own without
tagging the box. The reason it is not here is that the container joins the tailnet as **its own
node**, and that brings:

- an auth key to keep in `.env`, valid 90 days at most — lose the state volume after it expires and
  the container cannot rejoin, which is a trap that springs a quarter of a year later;
- a state volume, or it re-registers on every recreate;
- a second name and a second certificate, so every client that names this box changes, and the new
  name lands in the public certificate transparency logs;
- two mechanisms on one machine, since the dashboard and yt-archive stay on the host's serve.

Against that, what it would buy is already true here: tailscaled runs on this box with the operator
grant, the mapping survives a restart of the daemon, and `make up` re-applies it.

**Revisit it when any of these changes:** Forgejo moves to a host whose tailscaled we do not
control — a rented VPS, somebody else's Docker host — or the service needs an identity independent
of the machine it runs on, or this box starts serving so many things that one name per service is
worth the bookkeeping. The address is a variable on both sides, so the switch is a day's work, not
a redesign.

**Only these paths are reachable on that name.** `/`, `/user/login` and `/api/v1/…` answer `404`:
`tailscale serve` routes by path prefix, so Forgejo's web UI and API are not on it. It is `serve`
and not `funnel`, so nothing is reachable from the internet, and the name does not resolve in
public DNS. The certificate is a real Let's Encrypt one that Tailscale provisions for the `ts.net`
name, which is why no client needs `insecure-registries` or a private CA.

**Renaming the box** changes that name, and with it the URL every client uses. Nothing in this
directory has to change — `tailscale serve` publishes on whatever the node is called — but
`../forgejo-runner/.env` and the deploy's `REGISTRY` variable both name it, and the certificate is
reissued for the new name.

Who may push is a bot account, not a person: [registry-bot.sh](registry-bot.sh), whose decisions
are covered by `make test` — it stubs docker and curl, so it needs neither Forgejo nor a network.

## Accounts that are not people

One bot account per organisation that publishes images, made by
[registry-bot.sh](registry-bot.sh) and shaped the same way every time:

- named `<org>-bot`, and a member of that organisation's `packages` team and nothing else — Forgejo
  has no token scoped to one package, so the reach of the account is what limits a leaked token;
- its password is random and known to nobody, because the account exists to hold tokens;
- one token per holder — `registry-write-<pipeline>`, `registry-read-<box>` — because Forgejo
  refuses a name the account already has and can never print an old token again, and because
  revoking the box that pulls must not log out the pipeline that pushes.

**Which organisations those are is not written down here.** This repository is public and the
organisations on the instance are clients' and employers'; the concrete names live in the private
runbook of the project that uses them. `forgejo admin user list` inside the container is the
answer on the box itself.

Removing one: `forgejo admin user delete --username <name>`, also inside the container.

## Ports

- `3000` — web UI
- `222` — SSH (git over SSH)
- `443` (tailnet) — `tailscale serve` → `/v2`, the container registry

## Backup

Backups are stored in `/home/containers/backup/forgejo` as `forgejo-backup-YYYYMMDD_HHMMSS.tar.gz`.
The last 14 days are retained; older files are deleted automatically.

### Cron (daily at 3am)

```bash
make cron-install
```

## Runner

The Actions runner runs on a dedicated box — see [../forgejo-runner](../forgejo-runner).
Nothing runner-related lives here anymore.

Known Forgejo registry/package and Actions limitations: see
[forgejo-runner/CAVEATS.md](../forgejo-runner/CAVEATS.md).

## Caveats

What the application cannot do, and the workaround for each — closing a review conversation
over the API, an email invite with registration off: [CAVEATS.md](CAVEATS.md).


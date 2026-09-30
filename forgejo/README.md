# Forgejo application

Self-hosted Git service running in Docker on Raspberry Pi.

- Source: https://codeberg.org/forgejo/forgejo
- MCP server: https://codeberg.org/goern/forgejo-mcp
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

## The container registry over the tailnet

`git.insuit.cz` resolves to Cloudflare, which refuses a request body over 100 MiB, and a registry
push sends each layer as one request — measured on 2026-09-16: 100 MiB reached Forgejo (`401`),
101 MiB was refused (`413`). So a client that pushes images talks to this Pi's tailnet name instead,
and only the token request still goes through Cloudflare.

```bash
make serve         # publish /v2 on https://<host>.<tailnet>.ts.net
make serve-status  # show the current serve config
make unserve       # stop publishing it
```

`https://<host>.<tailnet>.ts.net/v2/` then answers `401`, the same as `http://<host>:3000/v2/` does
on the LAN. Like yt-archive, this needs the one-time `sudo tailscale set --operator=containers`.

Who may push is a bot account, not a person: [registry-bot.sh](registry-bot.sh).

## Accounts that are not people

| Account | What it is for | Made by | Notes |
|---|---|---|---|
| `trisbee-bot` | pushes and pulls the container images of the `trisbee` organisation | [registry-bot.sh](registry-bot.sh), 2026-09-30 | member of the `packages` team in that organisation and nothing else; its password is random and known to nobody, because it exists to hold tokens. Two tokens: `registry-write` for the pipeline, `registry-read` for the host that pulls |

A machine account is worth a row here for the same reason the stacks are in this repo: otherwise the
answer to "what is this and who made it" is somebody's memory. Removing one is
`forgejo admin user delete --username <name>` inside the container.

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


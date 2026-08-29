# Forgejo application

Self-hosted Git service running in Docker on Raspberry Pi.

Source: https://codeberg.org/forgejo/forgejo

## Configuration

Set the required env variable values before starting:

```bash
cp .env.example .env
```

## Usage

```bash
make build                                        # build the runner-tools image
make up                                           # start
make down                                         # stop
make logs                                         # follow logs
make backup                                       # run backup manually
make restore FILE=forgejo-backup-YYYYMMDD_HHMMSS.tar.gz
make cron-install                                 # register daily backup cron job (fails if already exists, run: crontab -l | grep forgejo)
make runner-register TOKEN=<registration-token>   # register the Actions runner (first time only)
```

## Ports

- `3000` — web UI
- `2222` — SSH (git over SSH)

## Backup

Backups are stored in `/home/containers/backup/forgejo` as `forgejo-backup-YYYYMMDD_HHMMSS.tar.gz`.
The last 14 days are retained; older files are deleted automatically.

### Cron (daily at 3am)

```bash
make cron-install
```

## Runner

The runner uses Docker-in-Docker (`dind`) to execute workflow jobs in isolated containers.

### First-time registration

With Forgejo 16, registration is config-based (no CLI step):

1. Forgejo UI: **Settings → Actions → Runners → Create new runner**
2. Copy the **UUID** and **Token** into `runner/config.yml` under `server.connections.forgejo`
3. Restart: `docker compose restart runner`

No `.runner` file is involved anymore.

### Labels

| Label           | Execution       | Image                                          |
|-----------------|-----------------|------------------------------------------------|
| `ubuntu-latest` | Docker via dind | `ghcr.io/catthehacker/ubuntu:act-22.04`        |
| `self-hosted`   | Host shell      | —                                              |


# Crons

User crontabs on the Pi. Each service ships its own `cron-install` target in its `Makefile` — that's the source of truth; this file is the index.

```bash
crontab -l            # inspect installed jobs
```

## Schedule

| Time                                          | Type        | Job                                                                        |
|-----------------------------------------------|-------------|----------------------------------------------------------------------------|
| 02:00                                         | backup      | [readeck](../readeck)                                                      |
| 03:00                                         | backup      | [forgejo](../forgejo)                                                      |
| 03:30                                         | cleanup     | [docker](../docker) — system prune (cluster-wide)                          |
| 04:00                                         | backup      | [database](../database)                                                    |
| 05:00                                         | backup      | [mealie](../mealie)                                                        |
| 06:00                                         | backup      | [yt-archive](../yt-archive)                                                |
| 06:15                                         | cleanup     | [github-runner](../github-runner) — image prune (>48h)                     |
| 07:00                                         | backup      | [archivebox](../archivebox)                                                |
| Sunday 01:00                                  | cleanup     | [docker](../docker) — log rotation (`~/logs/docker/*.log`, keep 4 weeks)   |
| every 4h at :30 (00:30, 04:30, 08:30, 12:30, 16:30, 20:30) | reliability | [github-runner](../github-runner) — safe-restart (cycle if no job is busy) |
| every 5 min                                   | reliability | [github-runner](../github-runner) — watchdog (cycle on stale queue + idle) |

The github-runner watchdog works around [actions/runner#1887](https://github.com/actions/runner/issues/1887) where ephemeral runners stay "Idle" on GitHub but stop receiving dispatched jobs. See [`github-runner/README.md`](../github-runner/README.md#watchdog-recover-from-stalled-job-pickup).

## Backups

Per-app backups store archives in `/home/containers/backup/<app>/` as `<app>-backup-YYYYMMDD_HHMMSS.tar.gz`. Last 14 days retained, older auto-pruned.

### Per-app commands

```bash
make backup                                       # run manually
make restore FILE=<app>-backup-YYYYMMDD_HHMMSS.tar.gz
make cron-install                                 # register daily cron (fails if already exists)
```

### Adding a backup service

1. Add `backup.sh` (tar `/data` → `/backup`) and `backup`/`restore`/`cron-install` targets to the service's `Makefile`, mirroring an existing app (readeck is the canonical pattern; yt-archive uses a bind mount instead of a named volume).
2. Pick the next free hour from the schedule table above and use it in the new `cron-install` line.
3. Add the row to the schedule table.

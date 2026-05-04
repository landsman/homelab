# Backups

Per-app backups run as user crontabs on the Pi via `make cron-install`. Each app stores archives in `/home/containers/backup/<app>/` as `<app>-backup-YYYYMMDD_HHMMSS.tar.gz`. Last 14 days retained, older auto-pruned. Source of truth: each app's `Makefile` `cron-install` target.

## Schedule

Each service gets a dedicated hour to avoid I/O contention.

| Time  | Service                     |
|-------|-----------------------------|
| 02:00 | [readeck](../readeck)       |
| 03:00 | [forgejo](../forgejo)       |
| 04:00 | [database](../database)     |
| 05:00 | [mealie](../mealie)         |
| 06:00 | [yt-archive](../yt-archive) |
| 07:00 | [archivebox](../archivebox) |

## Per-app commands

```bash
make backup                                       # run manually
make restore FILE=<app>-backup-YYYYMMDD_HHMMSS.tar.gz
make cron-install                                 # register daily cron (fails if already exists)
crontab -l                                        # inspect installed jobs
```

## Adding a service

1. Add `backup.sh` (tar `/data` → `/backup`) and `backup`/`restore`/`cron-install` targets to the service's `Makefile`, mirroring an existing app (readeck is the canonical pattern; yt-archive uses a bind mount instead of a named volume).
2. Pick the next free hour from the table above and use it in the new `cron-install` line.
3. Add the row to this file.

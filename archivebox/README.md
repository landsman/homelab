# ArchiveBox

Self-hosted web page archiver — saves URLs as HTML, PDF, screenshots, WARC, etc.

Source: https://archivebox.io — Image: https://hub.docker.com/r/archivebox/archivebox

## Usage

```bash
make init                                             # one-time: create admin user + init data dir
make up                                               # start
make down                                             # stop
make logs                                             # follow logs
make backup                                           # run backup manually
make restore FILE=archivebox-backup-YYYYMMDD_HHMMSS.tar.gz
make cron-install                                     # register daily backup cron job
```

`make init` is interactive — prompts for admin username/password and initializes the data volume. Run it once before `make up`.

## Ports

- `8002` — UI

## Backup

Backups are stored in `/home/containers/backup/archivebox` as `archivebox-backup-YYYYMMDD_HHMMSS.tar.gz`.
The last 14 days are retained; older files are deleted automatically.

### Cron (daily at 3am)

```bash
make cron-install
```

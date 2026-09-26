# Matomo

Self-hosted web analytics for www.insuit.cz and www.pollos.cz, running in Docker
on the Raspberry Pi. Cookieless tracking, so the sites need no consent banner.

Source: https://github.com/matomo-org/matomo

## Setup

1. `cp example.env .env` and set real passwords (the two `*_PASSWORD` for the
   `matomo` user must match).
2. `make up`
3. Route `stats.insuit.cz` to it: Cloudflare Zero Trust → Networks → Tunnels →
   the Pi's tunnel → **Published application routes** → `stats.insuit.cz` →
   `http://<pi-host>:8005`. Visitors' browsers load the tracker from there, so
   it has to be public.
4. Open https://stats.insuit.cz and run the installer through that hostname —
   Matomo records it as a trusted host. The database step is pre-filled from
   `.env`. Create the superuser, and add the sites in this order, because the
   pages hardcode the IDs:
   - site **1**: `https://www.insuit.cz`
   - site **2**: `https://www.pollos.cz`
5. Administration → Privacy → Anonymize data: mask visitor IPs by at least 2
   bytes.
6. `make cron-install` for the daily backup.

`common.config.ini.php` is mounted read-only over Matomo's own config: it trusts
Cloudflare's `CF-Connecting-IP` header and treats every request as HTTPS. Change
settings there, not with `console config:set`, which appends a duplicate on
every run.

The admin login is public along with the tracker. Consider a Cloudflare Access
policy on `stats.insuit.cz` that bypasses `/matomo.js` and `/matomo.php` only.

## Usage

```bash
make up       # start
make down     # stop
make logs     # follow logs
make backup   # database dump + config.ini.php
make restore FILE=matomo-db-YYYYMMDD_HHMMSS.sql.gz
make cron-install   # daily backup at 3am (fails if already installed: crontab -l | grep matomo)
```

## Backup

Stored in `/home/containers/backup/matomo`: a database dump
(`matomo-db-*.sql.gz`) and `config.ini.php` (`matomo-config-*.ini.php`), 14 days
retained. The config file holds the salt — restoring the database without it
invalidates every login, so put it back too:
`docker compose cp matomo-config-<date>.ini.php app:/var/www/html/config/config.ini.php`.

## Ports

- `8005` — web UI and tracker

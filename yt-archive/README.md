# YouTube Archive

Self-hosted YouTube (and other sites) downloader. Wraps [MeTube](https://github.com/alexta69/metube) — minimal web UI for `yt-dlp`. Paste URL → live progress → file lands in `./downloads`.

## Run

```bash
docker compose up -d
```

UI:
- LAN: `http://<pi-host>:8003`
- Tailscale (HTTPS, no port): `https://yt-archive.<tailnet>.ts.net/`

## Access (Tailscale)

MeTube listens on `0.0.0.0:8003` for LAN access. Tailscale `serve` additionally publishes it as the Tailscale Service `svc:yt-archive`, declared in [`pollos/infra/tailscale.tf`](../pollos/infra/tailscale.tf), so remote clients get a name of its own with a valid cert.

One-time setup (by admin user with sudo) — grant the `containers` user permission to run `tailscale serve` without sudo:

```bash
sudo tailscale set --operator=containers
```

A service is hosted only by a tagged device, so the NAS carries `tag:nas`, once. `tailscale up` refuses to drop a flag the node already runs with and prints the full command to use instead:

```bash
sudo tailscale up --advertise-tags=tag:nas
```

Then on the Pi:

```bash
make serve         # publish over tailnet HTTPS
make serve-status  # show current serve config
make unserve       # stop publishing
```

Lock down further with a tailnet ACL in the Tailscale admin if needed.

## Ports

| Port          | Container | Notes                    |
|---------------|-----------|--------------------------|
| 8003          | 8081      | MeTube web (LAN)         |
| 443 (tailnet) | —         | `svc:yt-archive` → 8003  |

## Storage

- `./downloads/` — finished media + `.metube/` state (queue, history, subscriptions)

## Backup

Backs up only `./downloads/.metube/` (state JSONs — queue, completed, subscriptions). Media files in `./downloads/` are not included.

```bash
make backup    # run backup manually
make restore FILE=yt-archive-backup-YYYYMMDD_HHMMSS.tar.gz
make cron-install   # daily 06:00 cron
```

Backups stored in `/home/containers/backup/yt-archive` as `yt-archive-backup-YYYYMMDD_HHMMSS.tar.gz`. Last 14 days retained, older auto-pruned.

## Update

```bash
docker compose pull && docker compose up -d
```

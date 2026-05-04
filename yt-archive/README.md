# YouTube Archive

Self-hosted YouTube (and other sites) downloader. Wraps [MeTube](https://github.com/alexta69/metube) — minimal web UI for `yt-dlp`. Paste URL → live progress → file lands in `./downloads`.

## Run

```bash
docker compose up -d
```

UI: http://<pi-host>:8003

## Ports

| Port | Container | Notes      |
|------|-----------|------------|
| 8003 | 8081      | MeTube web |

## Storage

- `./downloads/` — finished media + `.metube/` state (queue, history)

## Update

```bash
docker compose pull && docker compose up -d
```

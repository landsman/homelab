# Ports

Host ports exposed by containers on the Pi. Source of truth: each service's `compose.yml`.

| Port | Service                               | Notes                                      |
|------|---------------------------------------|--------------------------------------------|
| 222  | [forgejo](../forgejo) SSH             | git over SSH                               |
| 3000 | [forgejo](../forgejo)                 | web UI                                     |
| 3001 | [ip-service](../ip-service)           |                                            |
| 3031 | [gotenberg](../gotenberg)             | PDF conversion API                         |
| 5432 | [database](../database) (postgres 17) |                                            |
| 8000 | [database](../database) (adminer)     | DB admin UI                                |
| 8001 | [readeck](../readeck)                 |                                            |
| 8002 | [archivebox](../archivebox)           |                                            |
| 8003 | [yt-archive](../yt-archive)           | MeTube web UI (also tailscale serve → 443) |
| 8004 | [whisper-server](../whisper) | speech-to-text API; pollos nodes (not the Pi), 127.0.0.1 only — SSH tunnel |
| 8080 | [dashboard](../dashboard)             | nginx (also tailscale serve → 443 at /dashboard)    |
| 9925 | [mealie](../mealie)                   |                                            |

## Adding a service

Pick the next free port, add it here, and mirror it in the service README under a `## Ports` heading.

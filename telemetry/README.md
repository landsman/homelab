# Telemetry — Prometheus, Loki, Grafana

Hardware metrics, container metrics and logs for the Raspberry Pi 5, in one Grafana.

- **Prometheus** stores metrics for 30 days, capped at 10 GB
- **Node Exporter** reads the Pi itself: CPU, RAM, disk space, temperatures, network
- **cAdvisor** reads per-container CPU, memory and network
- **Blackbox Exporter** checks that the other services on the Pi answer, by the ports in [`.docs/PORTS.md`](../.docs/PORTS.md)
- **Loki** stores logs for 14 days
- **Alloy** ships every container's logs and the host journal (kernel, systemd, disk errors) into Loki
- **Grafana** comes up with both data sources and the dashboards already in place

## Ports

- `3210` — Prometheus, also takes OTLP metrics at `/api/v1/otlp/v1/metrics`
- `3211` — Grafana
- `3212` — Node Exporter (`/metrics`), on the host network
- `3215` — Loki, also takes OTLP logs at `/otlp/v1/logs`

Prometheus and Loki have no authentication, so they are published only on the Docker bridge (`172.17.0.1`, the default `docker0` address): containers on the Pi reach them at `host.docker.internal`, the LAN does not. Grafana is the way in from elsewhere. Docker-published ports skip `ufw`, which is why the bind address does this rather than the firewall. cAdvisor and Blackbox Exporter are not published at all; Prometheus scrapes them over the compose network.

## Reaching Grafana

- **At home** — `http://<pi>:3211`.
- **Away, on Tailscale** — the same address, over the tailnet.
- **Public hostname** — Grafana can be published on the Pi's Cloudflare Tunnel, behind Cloudflare Access that lets in only the owner's Cloudflare login coming from the home address, which away from home means through a Tailscale exit node. The Access rules are Terraform in [`pollos/infra/access.tf`](../pollos/infra/access.tf); its README has the order to set it up in, and the tunnel route is added only after Access exists. Set `GF_SERVER_ROOT_URL` in `.env` to that address.

Prometheus and Loki are not reachable from outside the Pi; their data is in Grafana. For the raw API, `ssh -L 3210:172.17.0.1:3210 <pi>`.

## First-time setup

```bash
cp .env.example .env   # set GF_SECURITY_ADMIN_PASSWORD, compose refuses to start without it
make setup             # data dirs owned by the users the images run as, plus the dashboards
make up
```

`make` with no target lists the rest.

The admin password is read only when Grafana creates its database. Changing it in `.env` later does nothing; use `docker exec grafana grafana cli admin reset-admin-password <new>`.

If the container memory panels stay empty, the kernel has the memory cgroup off: append `cgroup_enable=memory` to the single line in `/boot/firmware/cmdline.txt` and reboot.

## What is where in Grafana

- **Dashboards → Homelab → Node Exporter Full** — the Pi's hardware
- **Dashboards → Homelab → cadvisor dashboard** — containers, filterable by compose project
- **Dashboards → Homelab → Blackbox Exporter** — whether each service answers, and how fast
- **Drilldown → Logs** — every container and the journal, by `service_name`, with no query to write
- **Drilldown → Metrics** — everything Prometheus has, including whatever an app pushes

Dashboards come from grafana.com at a pinned revision (see `dashboards` in the `Makefile`) and are not committed. Edits made in the UI are lost on restart; export the JSON into `grafana/dashboards/` and commit it to keep one.

## Adding an application

- **Logs** — nothing to do. Alloy picks up every container on the Pi, labelled `container` and `compose_project`.
- **Metrics it exposes on `/metrics`** — add a job to `prometheus/prometheus.yml`. A container in another compose project is reached at `host.docker.internal:<host port>`.
- **OpenTelemetry** — from a container on the Pi, point the app's exporter at `http://host.docker.internal:3210/api/v1/otlp` for metrics and `http://host.docker.internal:3215/otlp` for logs, with `host.docker.internal:host-gateway` in its `extra_hosts`. Other machines on the LAN cannot reach either; that needs authentication in front first.
- **Uptime** — add its URL to the `blackbox` job.

## Backups

None, on purpose. Metrics keep 30 days and logs 14, and both fill up again on their own; losing them loses history, not anything to restore. The dashboards come from `make dashboards` and the config is in git.

## When something is missing

- **No logs arrive** — Loki refuses writes once the disk under `data/loki` is over 90 % full. The disk panel on Node Exporter Full shows it.
- **No journal logs** — Alloy reads `/var/log/journal` and `/run/log/journal`. Raspberry Pi OS may keep the journal in memory only; `systemd-analyze cat-config systemd/journald.conf | grep Storage` says which. Docker creates an empty `/var/log/journal` if it is missing, and with `Storage=auto` that turns on the on-disk journal from the next boot.
- **A service shows down that is running** — the probes and the Node Exporter scrape reach the host through `host.docker.internal`. A host firewall such as `ufw` has to allow the Docker bridge in.

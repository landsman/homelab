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
- `3213` — Blackbox Exporter
- `3214` — cAdvisor
- `3215` — Loki, also takes OTLP logs at `/otlp/v1/logs`

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
- **Drilldown → Logs** — every container and the journal, by `service_name`, with no query to write
- **Drilldown → Metrics** — everything Prometheus has, including whatever an app pushes

Dashboards come from grafana.com at a pinned revision (see `dashboards` in the `Makefile`) and are not committed. Edits made in the UI are lost on restart; export the JSON into `grafana/dashboards/` and commit it to keep one.

## Adding an application

- **Logs** — nothing to do. Alloy picks up every container on the Pi, labelled `container` and `compose_project`.
- **Metrics it exposes on `/metrics`** — add a job to `prometheus/prometheus.yml`. A container in another compose project is reached at `host.docker.internal:<host port>`.
- **OpenTelemetry** — point the app's exporter at `http://<pi>:3210/api/v1/otlp` for metrics and `http://<pi>:3215/otlp` for logs.
- **Uptime** — add its URL to the `blackbox` job.

## Backup and restore

```bash
make backup   # stops the stack, writes backup/telemetry-<timestamp>.tar.gz, starts it again
```

To restore, from this directory:

```bash
make down
sudo rm -rf data && sudo tar -xzf backup/telemetry-<timestamp>.tar.gz
make up
```

The archive holds `data/` itself, so it extracts in place, and `sudo` keeps the owners the containers need.

## When something is missing

- **No logs arrive** — Loki refuses writes once the disk under `data/loki` is over 90 % full. The disk panel on Node Exporter Full shows it.
- **No journal logs** — Alloy reads `/var/log/journal` and `/run/log/journal`. Raspberry Pi OS may keep the journal in memory only; `systemd-analyze cat-config systemd/journald.conf | grep Storage` says which. Docker creates an empty `/var/log/journal` if it is missing, and with `Storage=auto` that turns on the on-disk journal from the next boot.
- **A service shows down that is running** — the probes and the Node Exporter scrape reach the host through `host.docker.internal`. A host firewall such as `ufw` has to allow the Docker bridge in.

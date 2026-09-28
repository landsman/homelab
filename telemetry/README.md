# Telemetry — Prometheus, Loki, Grafana

Hardware metrics, container metrics and logs for the homelab, in one Grafana. The stack runs on the Pi (`nas`) under rootless Docker, as [docker/](../docker/README.md) sets it up; every host reports its own hardware.

- **Node Exporter**, on each host rather than in Docker: CPU, RAM, disks, temperatures, fan, network, SMART and NVMe wear. [host/](host/) installs it.
- **Telegraf** reads per-container CPU, memory and network from the Docker API
- **Blackbox Exporter** checks that the other services on the Pi answer, by the ports in [`.docs/PORTS.md`](../.docs/PORTS.md)
- **Prometheus** stores metrics for 30 days, capped at 10 GB
- **Loki** stores logs for 14 days
- **Alloy** ships every container's logs and the host journal (kernel, systemd, disk errors) into Loki
- **Grafana** opens on a Homelab overview, with both data sources and the dashboards in place

## Ports

- `3211` — Grafana
- `3210` — Prometheus, `127.0.0.1` only; OTLP metrics at `/api/v1/otlp/v1/metrics`
- `3215` — Loki, `127.0.0.1` only; OTLP logs at `/otlp/v1/logs`
- `9100` — Node Exporter on every host, on its Tailscale address only

Prometheus, Loki and Node Exporter have no authentication, which is why none of them is on the LAN. Docker-published ports skip `ufw`, so the bind address does that rather than the firewall. Telegraf and Blackbox Exporter are not published at all; Prometheus scrapes them over the compose network.

## Reaching Grafana

- **At home** — `http://<pi>:3211`.
- **Away, on Tailscale** — the same address, over the tailnet.
- **Public hostname** — on the Pi's Cloudflare Tunnel, behind Cloudflare Access. See [Public hostname](#public-hostname).

Prometheus and Loki are not reachable from outside the Pi; their data is in Grafana. For the raw API, `ssh -L 3210:127.0.0.1:3210 containers@<pi>`.

## First-time setup

Once per host, as an admin with sudo — the Docker user has none:

```bash
# on the Pi only: memory accounting and the journal for rootless containers, then reboot
sudo sh telemetry/host/docker-host.sh && sudo reboot

# on every host, the Pi and each pollos box
curl -fsSL https://raw.githubusercontent.com/landsman/homelab/main/telemetry/host/node-exporter.sh | sudo sh
```

Then on the Pi, as the Docker user (`containers`), from a login shell so `$XDG_RUNTIME_DIR` points at the rootless socket:

```bash
cp .env.example .env   # set GF_SECURITY_ADMIN_PASSWORD, compose refuses to start without it
make up
```

Clone the repo onto the RAID, not the SD card. The data itself is in named volumes, which live under Docker's data-root on the RAID wherever the checkout is.

`make` with no target lists the rest.

The admin password is read only when Grafana creates its database. Changing it in `.env` later does nothing; use `docker exec grafana grafana cli admin reset-admin-password <new>`.

## Host metrics

[`host/node-exporter.sh`](host/node-exporter.sh) installs Debian's `prometheus-node-exporter` and its collectors, bound to the host's Tailscale address on port 9100. Prometheus scrapes every host by MagicDNS name (`job="node"` in `prometheus/prometheus.yml`); a host is added there and nowhere else.

```bash
curl -fsSL https://raw.githubusercontent.com/landsman/homelab/main/telemetry/host/node-exporter.sh | sudo sh -s status     # units, and whether metrics are served
curl -fsSL https://raw.githubusercontent.com/landsman/homelab/main/telemetry/host/node-exporter.sh | sudo sh -s uninstall
```

- **Updates** come with `apt upgrade`. Package files are never edited: the listen address is a socket unit, the flags a drop-in, so an upgrade does not stop to ask about them.
- **Tailscale address changed** — re-run the install; it rebinds.
- **SMART and NVMe wear** come from the collectors package's own timers, every 15 minutes, into `/var/lib/prometheus/node-exporter/`.
- **More flags** go in `ARGS` in `/etc/default/prometheus-node-exporter`, which the drop-in still passes on.

[`host/docker-host.sh`](host/docker-host.sh) prepares the Pi that runs the stack. The Raspberry Pi kernel ships with the memory cgroup off, and rootless Docker gets only CPU and pids delegated, so without it no container reports memory. It also gives the Docker user a read ACL on the journal: a group would not reach the container, because runc drops supplementary groups. Both are safe to re-run; `make test` checks the `cmdline.txt` edit on a copy.

## What is where in Grafana

- **Home → Homelab** — anything wrong right now, temperatures, disks, memory, containers, error logs
- **Dashboards → Homelab → Node Exporter Full** — every metric of one host
- **Drilldown → Logs** — every container and the journal, by `service_name`, with no query to write
- **Drilldown → Metrics** — everything Prometheus has, including whatever an app pushes

The Homelab dashboard is committed in `grafana/dashboards/`. Node Exporter Full comes from grafana.com at a pinned revision, downloaded by `make up` the first time. Edits made in the UI are lost on restart; export the JSON over the file and commit it to keep them.

## Adding an application

- **Logs** — nothing to do. Alloy picks up every container on the Pi, labelled `container` and `compose_project`.
- **Metrics it exposes on `/metrics`** — add a job to `prometheus/prometheus.yml`, with the app's compose service joined to the `telemetry` network (below) or at `nas:<host port>` over the tailnet.
- **OpenTelemetry** — join the app to the `telemetry` network and push to `http://prometheus:9090/api/v1/otlp` for metrics and `http://loki:3100/otlp` for logs:

  ```yaml
  services:
    app:
      networks: [default, telemetry]
  networks:
    telemetry:
      external: true
  ```

- **Uptime** — add its URL to the `blackbox` job.

## Data

Metrics, logs, Grafana's database and Alloy's read positions are named volumes (`telemetry_prometheus`, `telemetry_loki`, `telemetry_grafana`, `telemetry_alloy`). No backups, on purpose: metrics keep 30 days and logs 14, and both fill up again on their own. `make destroy CONFIRM=yes` deletes all of it.

## Limits

What this does not do yet, so nobody assumes it does:

- **No alerts.** A full disk, a hot NVMe or the stack itself going down shows on the Homelab dashboard and nowhere else; someone has to look. Grafana alerting can send them once there is somewhere to send them to.
- **No memory limits** on Prometheus or Loki, and Loki has a time limit (14 days) but no size cap. A noisy app can grow either until the Pi runs short.
- **No Supabase metrics.** The hosted projects are not scraped; [Supabase's guide](https://supabase.com/docs/guides/telemetry/metrics/grafana-self-hosted) is the way in.
- **Checked only on the Pi itself**, not before merging: MagicDNS names resolving from a rootless container, the journal ACL, container memory after the reboot, and the Pi 5's temperature and fan sensors. [When something is missing](#when-something-is-missing) covers each.

## When something is missing

- **A host is down in "Hosts not reporting"** — `node-exporter.sh status` on that host. Prometheus reaches it by MagicDNS name, so the host has to be on the tailnet under that name.
- **Container memory is zero** — `docker-host.sh` has not run on the Pi, or it has not been rebooted since.
- **No journal logs** — the ACL from `docker-host.sh` is missing: `getfacl /var/log/journal`.
- **No logs at all** — Loki refuses writes once its disk is over 90 % full. The Homelab dashboard's disk panel shows it.
- **Every host and service down after a reboot** — the containers started before Tailscale took over DNS, so MagicDNS names do not resolve inside them. `docker compose up -d --force-recreate prometheus blackbox-exporter`, and check with `docker compose exec prometheus wget -qO- nas:9100/metrics | head`.
- **A service shows down that is running** — the probes go to `nas:<port>` over the tailnet, so the service has to publish on all interfaces, not `127.0.0.1`.

## Public hostname

Grafana can have a public hostname on the Pi's Cloudflare Tunnel, behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/). A request passes only when **both** hold:

- the Cloudflare login is the owner's email, and
- it comes from one of the home public ranges.

That second rule is how "only over Tailscale" is expressed. Cloudflare cannot see Tailscale; it sees the public address a request leaves from. Away from home that is the home address only through a Tailscale **exit node** on the home network, so switch one on before opening the hostname.

The Access rules are Terraform in [`infra/`](infra/), applied by `.github/workflows/telemetry-deploy.yml` on merge — merging is the deploy. `make -C infra ci` checks it locally without credentials. The tunnel itself is not in Terraform; its route is added by hand.

### Credentials

The deploy runs in the **`production`** GitHub environment, insuit's: the state is `telemetry.tfstate` in insuit's R2 bucket, so its R2 keys and account id are reused as they are. A secret that is missing or in another environment arrives as an empty string, and the variable validation then fails the deploy.

Reused, already there: `INSUIT_CZ_R2_ACCESS_KEY_ID`, `INSUIT_CZ_R2_SECRET_ACCESS_KEY`, `INSUIT_CZ_CF_ACCOUNT_ID`. New:

| Name | Kind | Where to get it |
|------|------|-----------------|
| `CF_ACCESS_API_TOKEN` | secret | Cloudflare → My Profile → API Tokens. One scope: `Account · Access: Apps and Policies · Edit` |
| `CF_ACCESS_EMAIL` | secret | the email of the Cloudflare login allowed through |
| `HOME_IP_RANGES` | secret | home public ranges as a list, IPv4 and IPv6: `["203.0.113.7/32", "2001:db8:1234::/56"]` |
| `GRAFANA_HOSTNAME` | var | the hostname Grafana gets on the tunnel |

`gh` prompts for the value, so it never lands in shell history:

```bash
gh secret set CF_ACCESS_API_TOKEN --repo landsman/homelab --env production
gh variable set GRAFANA_HOSTNAME --repo landsman/homelab --env production
```

### Order

So the hostname is never public without Access in front of it:

1. Create the API token and set the four new values above.
2. Merge. The deploy creates the Access application and its policies.
3. Only then, on the Pi's tunnel (Zero Trust → Networks → Tunnels → **Published application routes**), route the hostname to `http://<pi-host>:3211`.
4. Set `GF_SERVER_ROOT_URL` in `.env` to the hostname and `make up`, which recreates Grafana with it; `make restart` would keep the old environment.

Login is whatever the Zero Trust organization offers; new organizations sign in with the Cloudflare account itself, so no identity provider is created here.

When the home address changes, update `HOME_IP_RANGES` and re-run the deploy (`workflow_dispatch`); until then Access turns every request away.

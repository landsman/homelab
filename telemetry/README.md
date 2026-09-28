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
- **Public hostname** — on the Pi's Cloudflare Tunnel, behind Cloudflare Access. See [Public hostname](#public-hostname).

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

## Public hostname

Grafana can have a public hostname on the Pi's Cloudflare Tunnel, behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/). A request passes only when **both** hold:

- the Cloudflare login is the owner's email, and
- it comes from one of the home public ranges.

That second rule is how "only over Tailscale" is expressed. Cloudflare cannot see Tailscale; it sees the public address a request leaves from. Away from home that is the home address only through a Tailscale **exit node** on the home network, so switch one on before opening the hostname.

The Access rules are Terraform in [`infra/`](infra/), applied by `.github/workflows/telemetry-deploy.yml` on merge — merging is the deploy. `make -C infra ci` checks it locally without credentials. The tunnel itself is not in Terraform; its route is added by hand.

### Credentials

Everything lives in the **`telemetry`** GitHub environment. A secret that is missing or in another environment arrives as an empty string, and the variable validation then fails the deploy.

| Name | Kind | Where to get it |
|------|------|-----------------|
| `TELEMETRY_CF_API_TOKEN` | secret | Cloudflare → My Profile → API Tokens. One scope: `Account · Access: Apps and Policies · Edit` |
| `TELEMETRY_R2_ACCESS_KEY_ID` | secret | Cloudflare → R2 → API → Manage API tokens. Object Read/Write on `homelab-telemetry-tf-state` only |
| `TELEMETRY_R2_SECRET_ACCESS_KEY` | secret | same token, shown once at creation |
| `TELEMETRY_ACCESS_EMAIL` | secret | the email of the Cloudflare login allowed through |
| `TELEMETRY_HOME_IP_RANGES` | secret | home public ranges as a list, IPv4 and IPv6: `["203.0.113.7/32", "2001:db8:1234::/56"]` |
| `TELEMETRY_CF_ACCOUNT_ID` | var | Cloudflare account ID — dashboard URL, or Workers & Pages → Account details |
| `TELEMETRY_GRAFANA_HOSTNAME` | var | the hostname Grafana gets on the tunnel |

`gh` prompts for the value, so it never lands in shell history:

```bash
gh secret set TELEMETRY_CF_API_TOKEN --repo landsman/homelab --env telemetry
gh variable set TELEMETRY_GRAFANA_HOSTNAME --repo landsman/homelab --env telemetry
```

### Order

So the hostname is never public without Access in front of it:

1. Create the R2 bucket `homelab-telemetry-tf-state`, then the two tokens and the values above.
2. Merge. The deploy creates the Access application and its policies.
3. Only then, on the Pi's tunnel (Zero Trust → Networks → Tunnels → **Published application routes**), route the hostname to `http://<pi-host>:3211`.
4. Set `GF_SERVER_ROOT_URL` in `.env` to the hostname and `make up`, which recreates Grafana with it; `make restart` would keep the old environment.

Login is whatever the Zero Trust organization offers; new organizations sign in with the Cloudflare account itself, so no identity provider is created here.

When the home address changes, update `TELEMETRY_HOME_IP_RANGES` and re-run the deploy (`workflow_dispatch`); until then Access turns every request away.

# Monitoring Stack — Prometheus + Grafana

Self-hosted monitoring stack running on Raspberry Pi 5 via Docker Compose.

## Services

| Service           | URL                           |
|-------------------|-------------------------------|
| Prometheus        | `http://<pi-ip>:3210`         |
| Grafana           | `http://<pi-ip>:3211`         |
| Node Exporter     | `http://<pi-ip>:3212/metrics` |
| Blackbox Exporter | `http://<pi-ip>:3213`         |
| cAdvisor          | `http://<pi-ip>:3214`         |

Grafana login is configured via `.env` (see First-time Setup).

---

## Directory Structure

```
monitoring/
├── Makefile
├── docker-compose.yml
├── prometheus/
│   └── prometheus.yml
└── data/                  ← persisted data (backup this folder)
    ├── prometheus/
    └── grafana/
```

---

## Prerequisites

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Enable Docker on boot

```bash
sudo systemctl enable docker
```

Docker will start automatically on reboot and bring up all containers (via `restart: unless-stopped`).

---

## Usage

```bash
make setup    # first time only — create data dirs and fix permissions
make up       # start the stack
make down     # stop the stack
make restart  # restart all services
make logs     # follow logs
make ps       # show container status
make backup   # archive data/ into a timestamped .tar.gz
make destroy  # full wipe — stops containers, removes images, deletes data/
```

---

## First-time Setup

```bash
cp .env.example .env
# edit .env and set a strong password
make setup
make up
```

---

## Connect Grafana to Prometheus

1. Open Grafana → **Connections → Data Sources → Add → Prometheus**
2. URL: `http://prometheus:9090`
3. Click **Save & Test**

---

## Import Node Exporter Dashboard

1. Grafana → **Dashboards → Import**
2. Enter ID: `1860`
3. Select Prometheus as the data source

---

## Backup & Restore

All persistent data lives in `data/`. To back up:

```bash
make backup
# creates backup-YYYYMMDD-HHMMSS.tar.gz
```

To restore, extract the archive back into `data/` before running `make up`.

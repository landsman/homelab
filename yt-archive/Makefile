.DEFAULT_GOAL := help

LOCAL_PORT ?= 8003
SERVICE ?= svc:yt-archive
DATA_DIR := $(PWD)/downloads/.metube
BACKUP_DIR := /home/containers/backup/yt-archive

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Container
.PHONY: up down logs pull restart
up: ## start
	docker compose up -d

down: ## stop
	docker compose down

logs: ## follow the logs
	docker compose logs -f

pull: ## pull the images
	docker compose pull

restart: ## restart
	docker compose restart

##@ Tailnet
.PHONY: serve unserve serve-status
# Requires one-time `sudo tailscale set --operator=containers` so this user
# can run `tailscale serve` without sudo, and the NAS tagged tag:nas, see README.
serve: ## publish the Tailscale Service SERVICE
	tailscale serve --service=$(SERVICE) --bg --https=443 http://localhost:$(LOCAL_PORT)

unserve: ## stop publishing it
	tailscale serve --service=$(SERVICE) --https=443 off

serve-status: ## show what tailscale serves
	tailscale serve status

##@ Backup
.PHONY: backup restore cron-install
backup: ## tar MeTube's state into BACKUP_DIR
	@mkdir -p $(BACKUP_DIR)
	docker run --rm \
		-v $(DATA_DIR):/data:ro \
		-v $(BACKUP_DIR):/backup \
		-v $(PWD)/backup.sh:/backup.sh:ro \
		alpine sh /backup.sh

restore: ## restore one: make restore FILE=yt-archive-backup-YYYYMMDD_HHMMSS.tar.gz
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=yt-archive-backup-YYYYMMDD_HHMMSS.tar.gz" && exit 1)
	@test -f "$(BACKUP_DIR)/$(FILE)" || (echo "Error: Backup file $(BACKUP_DIR)/$(FILE) not found." && exit 1)
	@test -d "$(DATA_DIR)" || (echo "Error: $(DATA_DIR) does not exist. Run 'make up' first." && exit 1)
	docker run --rm \
		-v $(DATA_DIR):/data \
		-v $(BACKUP_DIR):/backup \
		alpine tar xzf /backup/$(FILE) -C /data

cron-install: ## run make backup every day at 6:00
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "yt-archive.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep yt-archive" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 6 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

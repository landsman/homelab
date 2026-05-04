.PHONY: up down logs pull restart serve unserve serve-status backup restore cron-install

LOCAL_PORT ?= 8003
SERVE_PATH ?= /yt-archive
DATA_DIR := $(PWD)/downloads/.metube
BACKUP_DIR := /home/containers/backup/yt-archive

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

pull:
	docker compose pull

restart:
	docker compose restart

# Requires one-time `sudo tailscale set --operator=containers` so this user
# can run `tailscale serve` without sudo.
serve:
	tailscale serve --bg --https=443 --set-path=$(SERVE_PATH) http://localhost:$(LOCAL_PORT)$(SERVE_PATH)

unserve:
	tailscale serve --https=443 --set-path=$(SERVE_PATH) off

serve-status:
	tailscale serve status

backup:
	@mkdir -p $(BACKUP_DIR)
	docker run --rm \
		-v $(DATA_DIR):/data:ro \
		-v $(BACKUP_DIR):/backup \
		-v $(PWD)/backup.sh:/backup.sh:ro \
		alpine sh /backup.sh

restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=yt-archive-backup-YYYYMMDD_HHMMSS.tar.gz" && exit 1)
	@test -f "$(BACKUP_DIR)/$(FILE)" || (echo "Error: Backup file $(BACKUP_DIR)/$(FILE) not found." && exit 1)
	@test -d "$(DATA_DIR)" || (echo "Error: $(DATA_DIR) does not exist. Run 'make up' first." && exit 1)
	docker run --rm \
		-v $(DATA_DIR):/data \
		-v $(BACKUP_DIR):/backup \
		alpine tar xzf /backup/$(FILE) -C /data

cron-install:
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "yt-archive.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep yt-archive" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 6 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

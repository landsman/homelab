VOLUME := forgejo_forgejo
BACKUP_DIR := /home/containers/backup/forgejo

.PHONY: up down logs serve unserve serve-status backup restore cron-install

# The container registry over the tailnet. git.insuit.cz goes through Cloudflare, which refuses a
# request body over 100 MiB, and an image layer is one request — so a push goes to the tailnet name
# instead. Requires the one-time `sudo tailscale set --operator=containers`, same as yt-archive.
SERVE_PATH ?= /v2

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

serve:
	tailscale serve --bg --https=443 --set-path=$(SERVE_PATH) http://127.0.0.1:3000$(SERVE_PATH)

unserve:
	tailscale serve --https=443 --set-path=$(SERVE_PATH) off

serve-status:
	tailscale serve status

backup:
	docker run --rm \
		-v $(VOLUME):/data:ro \
		-v $(BACKUP_DIR):/backup \
		-v $(PWD)/backup.sh:/backup.sh:ro \
		alpine sh /backup.sh

restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=forgejo-backup-YYYYMMDD_HHMMSS.tar.gz" && exit 1)
	@docker volume inspect $(VOLUME) > /dev/null 2>&1 || (echo "Error: volume $(VOLUME) does not exist. Run 'make up' first." && exit 1)
	docker run --rm \
		-v $(VOLUME):/data \
		-v $(BACKUP_DIR):/backup \
		alpine tar xzf /backup/$(FILE) -C /data

cron-install:
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "forgejo.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep forgejo" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 3 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

VOLUME := forgejo_forgejo
BACKUP_DIR := /home/containers/backup/forgejo

.PHONY: up down logs serve unserve serve-status backup restore cron-install

# Two paths published on this box's tailnet name, both to skip Cloudflare in front of git.insuit.cz:
#
#   /v2           the container registry. Cloudflare refuses a request body over 100 MiB and an
#                 image layer is one request, so a push cannot go through it at all.
#   /tools-mirror the mirrored actions the CI runner fetches, ten times per run. Not impossible
#                 through Cloudflare, just a trip to Prague and back for a box two hops away —
#                 which has timed out twice. ../forgejo-runner sends its fetches here.
#
# Nothing but these paths is reachable on that name: the web UI, the API and /user/login answer 404.
# Requires the one-time `sudo tailscale set --operator=containers`, same as yt-archive.
#
# No hostname appears here on purpose — `tailscale serve` publishes on the node's own name, so
# renaming the box needs no change in this file. What does need changing then is every client that
# names it; ../forgejo-runner/.env and the deploy's REGISTRY variable are the two today.
SERVE_PATHS ?= /v2 /tools-mirror

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

serve:
	@for p in $(SERVE_PATHS); do \
		tailscale serve --bg --https=443 --set-path=$$p http://127.0.0.1:3000$$p; \
	done

unserve:
	@for p in $(SERVE_PATHS); do \
		tailscale serve --https=443 --set-path=$$p off; \
	done

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

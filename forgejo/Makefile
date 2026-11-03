.DEFAULT_GOAL := help

VOLUME := forgejo_forgejo
BACKUP_DIR := /home/containers/backup/forgejo

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
# The mapping lives in tailscaled's own state, so it survives a restart of the daemon and of the
# box — checked on 2026-09-30: the yt-archive mapping from 2026-05-04 was still up after tailscaled
# restarted two days earlier. `make up` re-applies it anyway, because a rebuilt box has no state.
#
# No hostname appears here on purpose — `tailscale serve` publishes on the node's own name, so
# renaming the box needs no change in this file. What does need changing then is every client that
# names it; ../forgejo-runner/.env and the deploy's REGISTRY variable are the two today.
SERVE_PATHS ?= /v2 /tools-mirror

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Container
.PHONY: up down logs
# `serve` too, so bringing the stack up is also what publishes it — a reinstall of the box then
# needs no one to remember. It is idempotent, and a warning rather than a failure, because a box
# where this user is not the tailscale operator should still be able to start Forgejo.
up: ## start, and publish the tailnet paths
	docker compose up -d
	@$(MAKE) --no-print-directory serve || echo "warning: the tailnet paths are not published — see README"

down: ## stop
	docker compose down

logs: ## follow the logs
	docker compose logs -f

##@ Tailnet
.PHONY: serve unserve serve-status
serve: ## publish SERVE_PATHS on this box's tailnet name
	@for p in $(SERVE_PATHS); do \
		tailscale serve --bg --https=443 --set-path=$$p http://127.0.0.1:3000$$p; \
	done

unserve: ## stop publishing them
	@for p in $(SERVE_PATHS); do \
		tailscale serve --https=443 --set-path=$$p off; \
	done

serve-status: ## show what tailscale serves
	tailscale serve status

##@ Checks
.PHONY: test
# Stubs docker and curl, so it runs anywhere — no Forgejo, no network.
test: ## shellcheck the scripts and run their tests, no Forgejo needed
	@shellcheck registry-bot.sh registry-bot.test.sh merge-style.sh merge-style.test.sh
	@bash registry-bot.test.sh
	@bash merge-style.test.sh

##@ Settings
.PHONY: merge-style
# Squash by default and no merge commits, on every repository; see the header of merge-style.sh.
merge-style: ## squash by default and no merge commits, on every repository
	@./merge-style.sh apply

##@ Backup
.PHONY: backup restore cron-install
# Forgejo is stopped for the copy: a tar of a live volume can catch the database mid-write, and
# that is the copy an upgrade's rollback would restore. It starts again even when the copy fails.
backup: ## stop Forgejo, tar its volume into BACKUP_DIR, start it again
	docker compose stop forgejo
	docker run --rm \
		-v $(VOLUME):/data:ro \
		-v $(BACKUP_DIR):/backup \
		-v $(PWD)/backup.sh:/backup.sh:ro \
		alpine sh /backup.sh; status=$$?; docker compose start forgejo; exit $$status

restore: ## restore one: make restore FILE=forgejo-backup-YYYYMMDD_HHMMSS.tar.gz
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=forgejo-backup-YYYYMMDD_HHMMSS.tar.gz" && exit 1)
	@docker volume inspect $(VOLUME) > /dev/null 2>&1 || (echo "Error: volume $(VOLUME) does not exist. Run 'make up' first." && exit 1)
	docker compose stop forgejo
	docker run --rm \
		-v $(VOLUME):/data \
		-v $(BACKUP_DIR):/backup \
		alpine tar xzf /backup/$(FILE) -C /data
	@echo "Restored. Start it with make up, which recreates the container from compose.yml's version."

cron-install: ## run make backup every day at 3:00
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "forgejo.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep forgejo" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 3 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

-include ../pi.mk

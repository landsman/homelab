.DEFAULT_GOAL := help

VOLUME := authelia_data
BACKUP_DIR := /home/containers/backup/authelia

# FORGEJO_MCP_HOST for cli/user.ts: the same .env the containers read.
-include .env
export FORGEJO_MCP_HOST

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Container
.PHONY: up down logs
up: ## start
	docker compose up -d

down: ## stop
	docker compose down

logs: ## follow the logs
	docker compose logs -f

##@ Setup, on the Pi
.PHONY: secrets user integration code test
# Made here and printed nowhere. Copy the folder into 1Password right after: losing `storage`
# makes the database unreadable. They never change, so one copy is enough.
secrets: ## generate the secrets Authelia needs, the ones missing
	@umask 077 && mkdir -p secrets && for f in jwt session storage oidc-hmac; do [ -s secrets/$$f ] || openssl rand -hex 32 >secrets/$$f; done
	@[ -s secrets/oidc.pem ] || (umask 077 && openssl genrsa -out secrets/oidc.pem 2048 2>/dev/null)
	@echo "secrets/ complete; now, on the laptop, make secrets-backup PI=<ssh host> VAULT=<vault>"

user: ## add USER with EMAIL; the password comes on stdin, piped from the laptop (README)
	bun cli/user.ts login $(USER) $(EMAIL)

integration: ## create USER's Forgejo integration and write forgejo_aud; forgejo-mcp must be up
	bun cli/user.ts integration $(USER)

##@ 1Password, from the laptop
.PHONY: secrets-backup secrets-restore
# 1Password is signed in on the laptop, not on the Pi, so the folder travels over ssh as one tar,
# into a single document, never on screen. pipefail, so a failed ssh or op fails the target;
# set in the recipe, since macOS's make 3.81 ignores .SHELLFLAGS.
PI_DIR ?= containers/apps/authelia
secrets-backup secrets-restore: SHELL := /bin/bash

secrets-backup: ## copy the Pi's secrets/ into 1Password: make secrets-backup PI=<ssh host> VAULT=<vault>
	@test -n "$(PI)" -a -n "$(VAULT)" || (echo "usage: make secrets-backup PI=<ssh host> VAULT=<vault>" && exit 1)
	@ssh $(PI) 'test -s $(PI_DIR)/secrets/storage' || (echo "no secrets/ in $(PI):$(PI_DIR); make secrets there first" && exit 1)
	@set -o pipefail; ssh $(PI) 'tar czf - -C $(PI_DIR) secrets' | op document create - --vault "$(VAULT)" --title "Authelia secrets" --file-name authelia-secrets.tar.gz >/dev/null
	@echo "secrets/ is in 1Password as \"Authelia secrets\""

secrets-restore: ## put secrets/ back on a rebuilt Pi: make secrets-restore PI=<ssh host> VAULT=<vault>
	@test -n "$(PI)" -a -n "$(VAULT)" || (echo "usage: make secrets-restore PI=<ssh host> VAULT=<vault>" && exit 1)
	@set -o pipefail; op document get "Authelia secrets" --vault "$(VAULT)" \
		| ssh $(PI) 'cd $(PI_DIR) && test ! -e secrets && umask 077 && tar xzf -' \
		|| (echo "not restored: op failed, or $(PI):$(PI_DIR)/secrets exists; move it away first" && exit 1)

##@ Backup
.PHONY: backup restore cron-install
# As readeck's: a tar in BACKUP_DIR each night, to be copied off the box from there.
# The database and users.yml, not secrets/: the storage key next to the database it
# encrypts would undo the encryption. secrets/ goes to 1Password once.
# Authelia is paused for the copy, so SQLite sees a crash-consistent file it can recover.
backup: ## tar the database and users.yml into BACKUP_DIR, keep 14 days
	@mkdir -p $(BACKUP_DIR)
	docker pause authelia >/dev/null; docker run --rm \
		-v $(VOLUME):/data:ro \
		-v $(PWD)/users.yml:/users.yml:ro \
		-v $(BACKUP_DIR):/backup \
		-v $(PWD)/backup.sh:/backup.sh:ro \
		alpine sh /backup.sh; rc=$$?; docker unpause authelia >/dev/null; exit $$rc

# users.yml is written into, not replaced: the container mounts that one file.
restore: ## restore one: make restore FILE=authelia-backup-YYYYMMDD_HHMMSS.tar.gz
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=authelia-backup-YYYYMMDD_HHMMSS.tar.gz" && exit 1)
	@docker volume inspect $(VOLUME) > /dev/null 2>&1 || (echo "Error: volume $(VOLUME) does not exist. Run 'make up' first." && exit 1)
	docker compose stop authelia
	docker run --rm \
		-v $(VOLUME):/data \
		-v $(BACKUP_DIR):/backup \
		alpine tar xzf /backup/$(FILE) -C / data
	tar xzf $(BACKUP_DIR)/$(FILE) -O users.yml >users.yml
	docker compose start authelia

cron-install: ## run make backup every night at 3:30
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "authelia.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep authelia" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "30 3 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

# Authelia sends the one-time code for registering a passkey or TOTP by "mail", which here
# is a file in its volume.
code: ## print the last one-time code Authelia sent
	docker exec authelia tail -n 20 /data/notification.txt

# The tooling (Bun types, oxfmt, oxlint) is the repository's, one level up.
test: ## format-check, lint, type-check and test cli/
	@$(MAKE) -s -C .. qa

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
# Made here and printed nowhere. Copy the folder into 1Password once: losing `storage`
# makes the database unreadable, losing `oidc.pem` signs every device out.
secrets: ## generate the secrets Authelia needs, the ones missing
	@umask 077 && mkdir -p secrets && for f in jwt session storage oidc-hmac; do [ -s secrets/$$f ] || openssl rand -hex 32 >secrets/$$f; done
	@[ -s secrets/oidc.pem ] || (umask 077 && openssl genrsa -out secrets/oidc.pem 2048 2>/dev/null)
	@echo "secrets/ complete"

user: ## add USER with EMAIL; the password comes on stdin: op read … | make user USER=… EMAIL=…
	bun cli/user.ts login $(USER) $(EMAIL)

integration: ## create USER's Forgejo integration and write forgejo_aud; forgejo-mcp must be up
	bun cli/user.ts integration $(USER)

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

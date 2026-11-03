.DEFAULT_GOAL := help

VOLUME := readeck_data
BACKUP_DIR := /home/containers/backup/readeck

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

##@ Backup
.PHONY: backup restore cron-install
backup: ## tar the data volume into BACKUP_DIR
	docker run --rm \
		-v $(VOLUME):/data:ro \
		-v $(BACKUP_DIR):/backup \
		-v $(PWD)/backup.sh:/backup.sh:ro \
		alpine sh /backup.sh

restore: ## restore one: make restore FILE=readeck-backup-YYYYMMDD_HHMMSS.tar.gz
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=readeck-backup-YYYYMMDD_HHMMSS.tar.gz" && exit 1)
	@docker volume inspect $(VOLUME) > /dev/null 2>&1 || (echo "Error: volume $(VOLUME) does not exist. Run 'make up' first." && exit 1)
	docker run --rm \
		-v $(VOLUME):/data \
		-v $(BACKUP_DIR):/backup \
		alpine tar xzf /backup/$(FILE) -C /data

cron-install: ## run make backup every day at 2:00
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "readeck.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep readeck" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 2 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

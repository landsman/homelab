.DEFAULT_GOAL := help

SERVICE = postgres17
PG_USER = postgres
BACKUP_DIR = /home/containers/backup/database

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Container
.PHONY: up down logs psql
up: ## start
	docker compose up -d

down: ## stop
	docker compose down

logs: ## follow the logs
	docker compose logs -f

psql: ## open psql as the postgres user
	docker compose exec $(SERVICE) psql -U $(PG_USER)

##@ Backup
.PHONY: backup restore cron-install
backup: ## pg_dumpall into BACKUP_DIR, keep 14 days
	docker compose exec $(SERVICE) sh -c \
		"pg_dumpall -U $(PG_USER) | gzip > /tmp/backup.sql.gz && cat /tmp/backup.sql.gz" \
		> $(BACKUP_DIR)/database-backup-$(shell date +%Y%m%d_%H%M%S).sql.gz
	find $(BACKUP_DIR) -name "database-backup-*.sql.gz" -mtime +14 -delete

restore: ## restore one: make restore FILE=database-backup-YYYYMMDD_HHMMSS.sql.gz
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=database-backup-YYYYMMDD_HHMMSS.sql.gz" && exit 1)
	gunzip -c $(BACKUP_DIR)/$(FILE) | docker compose exec -T $(SERVICE) psql -U $(PG_USER)

cron-install: ## run make backup every day at 4:00
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "database.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep database" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 4 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

BACKUP_DIR := /home/containers/backup/matomo

.PHONY: up down logs backup restore cron-install

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

backup:
	BACKUP_DIR=$(BACKUP_DIR) ./backup.sh

restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=matomo-db-YYYYMMDD_HHMMSS.sql.gz" && exit 1)
	gunzip -c $(BACKUP_DIR)/$(FILE) | docker compose exec -T db sh -c 'mariadb -u root -p"$$MARIADB_ROOT_PASSWORD" "$$MARIADB_DATABASE"'

cron-install:
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "matomo.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep matomo" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 3 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

SERVICE = postgres17
PG_USER = postgres
BACKUP_DIR = /home/containers/backup/database

.PHONY: up down logs backup restore psql cron-install

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

psql:
	docker compose exec $(SERVICE) psql -U $(PG_USER)

backup:
	docker compose exec $(SERVICE) sh -c \
		"pg_dumpall -U $(PG_USER) | gzip > /tmp/backup.sql.gz && cat /tmp/backup.sql.gz" \
		> $(BACKUP_DIR)/database-backup-$(shell date +%Y%m%d_%H%M%S).sql.gz
	find $(BACKUP_DIR) -name "database-backup-*.sql.gz" -mtime +14 -delete

restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=database-backup-YYYYMMDD_HHMMSS.sql.gz" && exit 1)
	gunzip -c $(BACKUP_DIR)/$(FILE) | docker compose exec -T $(SERVICE) psql -U $(PG_USER)

cron-install:
	@mkdir -p $(BACKUP_DIR)
	@crontab -l 2>/dev/null | grep -q "database.*make backup" \
		&& (echo "Cron job already exists. To view: crontab -l | grep database" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 4 * * * cd $(PWD) && make backup >> $(BACKUP_DIR)/backup.log 2>&1") | crontab -
	@echo "Cron job installed."

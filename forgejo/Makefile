VOLUME := forgejo_forgejo
BACKUP_DIR := /home/containers/backup/forgejo

.PHONY: up down logs backup restore runner-register build cron-install

build:
	docker compose --profile build build runner-tools

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

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

runner-register:
	@test -n "$(TOKEN)" || (echo "Usage: make runner-register TOKEN=<registration-token>" && exit 1)
	@test -n "$(FORGEJO_URL)" || (echo "Error: FORGEJO_URL is not set. Run: export FORGEJO_URL=https://your-forgejo-url" && exit 1)
	docker exec -it forgejo-runner forgejo-runner register \
		--instance $(FORGEJO_URL) \
		--token $(TOKEN) \
		--name raspberry-pi \
		--labels "ubuntu-latest:docker://node:20-bookworm,self-hosted:host" \
		--no-interactive
	docker restart forgejo-runner

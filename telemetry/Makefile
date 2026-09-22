.PHONY: setup up down destroy restart logs ps backup help

setup:
	mkdir -p data/prometheus data/grafana
	sudo chown -R 472:472 data/grafana

up:
	docker compose up -d

down:
	docker compose down

destroy:
	docker compose down --rmi all --volumes --remove-orphans
	sudo rm -rf data/

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

backup:
	mkdir -p backup
	tar -czf backup/backup-$(shell date +%Y%m%d-%H%M%S).tar.gz data/

help:
	@echo "Available commands:"
	@echo "  make setup    - Create data directories with correct permissions"
	@echo "  make up       - Start all services"
	@echo "  make down     - Stop all services"
	@echo "  make destroy  - Stop all services, remove images, and delete all data"
	@echo "  make restart  - Restart all services"
	@echo "  make logs     - Follow logs from all services"
	@echo "  make ps       - Show running containers"
	@echo "  make backup   - Archive data/ into a timestamped .tar.gz"

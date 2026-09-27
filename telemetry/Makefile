.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Setup
.PHONY: setup dashboards
setup: dashboards ## create data directories owned by the users the images run as
	mkdir -p data/prometheus data/grafana data/loki
	sudo chown -R 65534:65534 data/prometheus  # nobody, in prom/prometheus
	sudo chown -R 472:472 data/grafana
	sudo chown -R 10001:10001 data/loki

# grafana.com /api/dashboards/<id>/revisions/<revision>; bump the revision to update one
dashboards: ## download the pinned grafana dashboards
	mkdir -p grafana/dashboards
	curl -fsSL -o grafana/dashboards/node-exporter-full.json https://grafana.com/api/dashboards/1860/revisions/45/download
	curl -fsSL -o grafana/dashboards/cadvisor.json https://grafana.com/api/dashboards/19792/revisions/6/download

##@ Run
.PHONY: up down restart logs ps
up: ## start all services
	docker compose up -d

down: ## stop all services
	docker compose down

restart: ## restart all services
	docker compose restart

logs: ## follow logs from all services
	docker compose logs -f

ps: ## show running containers
	docker compose ps

##@ Data
.PHONY: backup destroy
backup: ## stop the stack, archive data/ into backup/, start it again
	mkdir -p backup
	docker compose stop
	sudo tar -czf backup/telemetry-$(shell date +%Y%m%d-%H%M%S).tar.gz data/ || (docker compose start && false)
	docker compose start

destroy: ## stop all services, remove images, and delete all data
	docker compose down --rmi all --volumes --remove-orphans
	sudo rm -rf data/

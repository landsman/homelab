.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# grafana.com /api/dashboards/<id>/revisions/<revision>; bump the revision to update it
NODE_EXPORTER_FULL := grafana/dashboards/node-exporter-full.json

##@ Run
.PHONY: up down restart logs ps
up: $(NODE_EXPORTER_FULL) ## start all services
	docker compose up -d

down: ## stop all services
	docker compose down

restart: ## restart all services, keeping their environment
	docker compose restart

logs: ## follow logs from all services
	docker compose logs -f

ps: ## show running containers
	docker compose ps

$(NODE_EXPORTER_FULL):
	curl -fsSL -o $@ https://grafana.com/api/dashboards/1860/revisions/45/download

##@ Checks
.PHONY: lint test
lint: ## shellcheck the host scripts
	shellcheck host/*.sh

test: ## run the host scripts' test (on Linux: it uses GNU sed)
	sh host/test.sh

##@ Data
.PHONY: destroy
destroy: ## stop all services, remove images, and delete all metrics and logs (needs CONFIRM=yes)
	@test "$(CONFIRM)" = yes || { echo "deletes every metric and log; run make destroy CONFIRM=yes"; exit 1; }
	docker compose down --rmi all --volumes --remove-orphans

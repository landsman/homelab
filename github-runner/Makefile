.DEFAULT_GOAL := help

LOG_DIR := $(HOME)/logs/docker

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Runner
.PHONY: build up stop down restart logs
build: ## build the runner image
	docker compose --profile nodejs build

up: ## start the runner
	docker compose up -d

stop: ## stop the containers
	docker compose stop

down: ## stop and remove the runner
	docker compose down --remove-orphans

restart: ## rebuild and restart the runner
	docker compose down --remove-orphans
	docker compose up -d --build

logs: ## follow runner logs
	docker compose logs -f

##@ Housekeeping
.PHONY: prune cron-install
prune: ## remove images older than 48h
	@docker image prune -a --force --filter "until=48h" 2>&1 | tee -a $(LOG_DIR)/github-runner-prune.log

cron-install: ## install cron job to prune images daily at 6am
	@crontab -l 2>/dev/null | grep -q "github-runner.*make prune" \
		&& (echo "Cron job already exists. To view: crontab -l | grep github-runner" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 6 * * * cd $(PWD) && make prune") | crontab -
	@echo "Cron job installed."

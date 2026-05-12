LOG_DIR := $(HOME)/logs/docker

.PHONY: help build up down restart cycle logs prune safe-restart watchdog cron-install cron-install-watchdog

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

build: ## Build the runner image
	docker compose --profile nodejs build

up: ## Start the runner
	docker compose up -d

stop: ## STop containers
	docker compose stop

down: ## Stop and remove the runner
	docker compose down --remove-orphans

restart: ## Rebuild and restart the runner
	docker compose down --remove-orphans
	docker compose up -d --build

cycle: ## Restart without rebuild (down + up)
	docker compose down --remove-orphans
	docker compose up -d

logs: ## Follow runner logs
	docker compose logs -f

prune: ## Remove images older than 48h
	@docker image prune -a --force --filter "until=48h" 2>&1 | tee -a $(LOG_DIR)/github-runner-prune.log

safe-restart: ## Cycle runners only if none are busy (used by daily cron)
	@mkdir -p $(LOG_DIR)
	@./runner-ctl.sh safe-restart 2>&1 | tee -a $(LOG_DIR)/github-runner-watchdog.log

watchdog: ## Cycle runners if queue is stale and runners are idle (used by 5min cron)
	@mkdir -p $(LOG_DIR)
	@./runner-ctl.sh watchdog 2>&1 | tee -a $(LOG_DIR)/github-runner-watchdog.log

cron-install: ## Install cron job to prune images daily at 6am
	@crontab -l 2>/dev/null | grep -q "github-runner.*make prune" \
		&& (echo "Cron job already exists. To view: crontab -l | grep github-runner" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "0 6 * * * cd $(PWD) && make prune") | crontab -
	@echo "Cron job installed."

cron-install-watchdog: ## Install 4am safe-restart + 5min watchdog cron jobs
	@( crontab -l 2>/dev/null | grep -v "github-runner.*make safe-restart" | grep -v "github-runner.*make watchdog"; \
	   echo "0 4 * * * cd $(PWD) && make safe-restart"; \
	   echo "*/5 * * * * cd $(PWD) && make watchdog" ) | crontab -
	@echo "Watchdog cron jobs installed (4am safe-restart, every 5min watchdog)."

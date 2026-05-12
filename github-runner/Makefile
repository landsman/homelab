LOG_DIR := $(HOME)/logs/docker

.PHONY: help build up down restart cycle logs prune safe-restart watchdog watchdog-stats cron-install

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

watchdog-stats: ## Count watchdog cycle events in the log (last day / total)
	@echo "Today:  $$(grep "$$(date +%Y-%m-%d)" $(LOG_DIR)/github-runner-watchdog.log 2>/dev/null | grep -c 'cycling' || echo 0)"
	@echo "Total:  $$(grep -c 'cycling' $(LOG_DIR)/github-runner-watchdog.log 2>/dev/null || echo 0)"

cron-install: ## Install all github-runner cron jobs (image prune, safe-restart, watchdog)
	@( crontab -l 2>/dev/null \
	     | grep -v "github-runner.*make prune" \
	     | grep -v "github-runner.*make safe-restart" \
	     | grep -v "github-runner.*make watchdog"; \
	   echo "15 6 * * * cd $(PWD) && make prune"; \
	   echo "30 */4 * * * cd $(PWD) && make safe-restart"; \
	   echo "*/5 * * * * cd $(PWD) && make watchdog" ) | crontab -
	@echo "Cron jobs installed: image prune (06:15), safe-restart (every 4h at :30), watchdog (every 5min)."

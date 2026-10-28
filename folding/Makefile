.DEFAULT_GOAL := help
.PHONY: help rsync up down logs status

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

rsync: ## Copy this dir to a box (HOST=saul.pollos)
	@[ -n "$(HOST)" ] || { echo "Set HOST, e.g. HOST=saul.pollos"; exit 1; }
	rsync -av --exclude data --exclude .env ./ "$(HOST)":folding/

up: ## Start folding (run on the box)
	mkdir -p data
	PUID=$$(id -u) PGID=$$(id -g) MACHINE_NAME=$$(hostname) docker compose up -d

down: ## Stop folding
	docker compose down

logs: ## Follow logs
	docker compose logs -f

status: ## Show container state and CPU use
	docker stats --no-stream foldingathome

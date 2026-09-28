.DEFAULT_GOAL := help

LOCAL_PORT ?= 8005
SERVE_PATH ?= /forgejo-mcp

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Container
.PHONY: up down logs build
up: ## build if needed and start
	docker compose up -d --build

down: ## stop
	docker compose down

logs: ## follow the logs
	docker compose logs -f

build: ## rebuild, after bumping FORGEJO_MCP_VERSION in .env
	docker compose build --pull

##@ Tailnet
# Requires one-time `sudo tailscale set --operator=containers` so this user
# can run `tailscale serve` without sudo.
.PHONY: serve unserve serve-status
serve: ## publish on https://<pi>.<tailnet>.ts.net/forgejo-mcp
	tailscale serve --bg --https=443 --set-path=$(SERVE_PATH) http://localhost:$(LOCAL_PORT)/mcp

unserve: ## stop publishing
	tailscale serve --https=443 --set-path=$(SERVE_PATH) off

serve-status: ## show what tailscale serve publishes
	tailscale serve status

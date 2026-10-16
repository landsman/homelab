.DEFAULT_GOAL := help

# The tailnet port the runners reach the cache on. Not 443: `/v2` there is Forgejo's own registry
# (../forgejo), and a registry is always at `/v2`, so the two cannot share a port.
SERVE_PORT ?= 5000

.PHONY: help up down logs serve unserve size

help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Running it
# `serve` too, so bringing the stack up also publishes it, and a rebuilt box needs no one to remember.
up: ## start the cache and publish it on the tailnet
	docker compose up -d
	@$(MAKE) --no-print-directory serve || echo "warning: not published on the tailnet — see README"

down: ## stop the cache; the boxes fall back to Docker Hub
	docker compose down

logs: ## follow the log, one line per pull it serves
	docker compose logs -f

size: ## how much the cache holds now
	docker compose exec registry-mirror du -sh /var/lib/registry

##@ Tailnet
serve: ## publish it on the tailnet, https on SERVE_PORT
	tailscale serve --bg --https=$(SERVE_PORT) http://127.0.0.1:5000

unserve: ## take it off the tailnet
	tailscale serve --https=$(SERVE_PORT) off

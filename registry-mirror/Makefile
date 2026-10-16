.DEFAULT_GOAL := help

# The ports the caches have on the NAS, one per registry, published on the tailnet as https on the
# same number (compose.yml has the table). Not 443: `/v2` there is Forgejo's own registry
# (../forgejo), and a registry is always at `/v2`, so the two cannot share a port.
SERVE_PORTS ?= 5000 5001 5002 5003

.PHONY: help up down logs serve unserve size

help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Running it
# `serve` too, so bringing the stack up also publishes it, and a rebuilt box needs no one to remember.
up: ## start the caches and publish them on the tailnet
	docker compose up -d
	@$(MAKE) --no-print-directory serve || echo "warning: not published on the tailnet — see README"

down: ## stop the caches; the boxes fall back to the registries themselves
	docker compose down

logs: ## follow the logs, one line per request a cache serves
	docker compose logs -f

size: ## how much each cache holds now
	@for s in $$(docker compose ps --services); do printf '%-18s ' "$$s"; docker compose exec "$$s" du -sh /var/lib/registry; done

##@ Tailnet
serve: ## publish the caches on the tailnet, https on SERVE_PORTS
	@for p in $(SERVE_PORTS); do tailscale serve --bg --https=$$p http://127.0.0.1:$$p; done

unserve: ## take them off the tailnet
	@for p in $(SERVE_PORTS); do tailscale serve --https=$$p off; done

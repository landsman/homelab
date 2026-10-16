.DEFAULT_GOAL := help

# What the tailnet sees: one address, https://<this box>/mirror/<registry>, on the same port 443 as
# Forgejo's `/v2` (../forgejo). `tailscale serve` strips the mount path, so each cache gets the
# `/v2/…` it expects, and Docker appends `/v2` to the mirror's path itself. Each entry is
# <registry>=<its cache's local port in compose.yml>.
SERVE ?= docker.io=5000 ghcr.io=5001 docker.gitea.com=5002 code.forgejo.org=5003

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
serve: ## publish the caches on the tailnet under /mirror/<registry>
	@for e in $(SERVE); do tailscale serve --bg --https=443 --set-path=/mirror/$${e%%=*} http://127.0.0.1:$${e#*=}; done

unserve: ## take them off the tailnet, Forgejo's paths stay
	@for e in $(SERVE); do tailscale serve --https=443 --set-path=/mirror/$${e%%=*} off; done

.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# grafana.com /api/dashboards/1860; bump the revision to update it, and the
# Makefile change alone makes the next make up fetch it again
NODE_EXPORTER_FULL := grafana/dashboards/node-exporter-full.json
NODE_EXPORTER_FULL_REVISION := 45

# a recipe cut off halfway leaves no target that make would take as up to date
.DELETE_ON_ERROR:

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

# tagged homelab too, so the other dashboards' links list it
$(NODE_EXPORTER_FULL): Makefile
	curl -fsSL -o $@.tmp https://grafana.com/api/dashboards/1860/revisions/$(NODE_EXPORTER_FULL_REVISION)/download
	jq '.tags += ["homelab"]' $@.tmp > $@
	rm $@.tmp

##@ Checks
.PHONY: lint test check
# CI has no mise and passes SHELLCHECK=shellcheck, the runner's own.
SHELLCHECK ?= mise exec shellcheck -- shellcheck
lint: ## shellcheck every script
	$(SHELLCHECK) $$(git ls-files '*.sh')

check: ## parse every config the stack loads, with the pinned images (needs docker)
	./check.sh

test: ## run every *.test.sh (on Linux: they use GNU sed)
	@rc=0; for t in $$(git ls-files '*.test.sh'); do echo "== $$t"; "./$$t" || { echo "FAIL $$t"; rc=1; }; done; exit $$rc

##@ Data
.PHONY: destroy
destroy: ## stop all services, remove images, and delete all metrics and logs (needs CONFIRM=yes)
	@test "$(CONFIRM)" = yes || { echo "deletes every metric and log; run make destroy CONFIRM=yes"; exit 1; }
	docker compose down --rmi all --volumes --remove-orphans

.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Setup
.PHONY: install install-ci
install: ## install the pinned tools (node, wrangler via mise) and the npm dev deps
	mise install
	npm install

install-ci: ## install the npm deps from the lockfile, in CI where the runner provides node
	npm ci --no-audit --no-fund

##@ Worker
.PHONY: dev deploy tail
dev: ## run the Worker and its Durable Object locally, ws://localhost:8787/cursors
	mise exec -- wrangler dev

# The custom domain microsite-ws.pollos.cz lives in pollos/infra.
deploy: ## deploy the Worker to Cloudflare; CI does it, this is the manual push
	mise exec -- wrangler deploy

tail: ## stream the deployed Worker's live logs
	mise exec -- wrangler tail

##@ Checks
.PHONY: ci format
ci: ## type-check and check the formatting
	npm run typecheck
	npm run format:check

# Config in the repo root .oxfmtrc.json.
format: ## format the source with oxfmt
	npm run format

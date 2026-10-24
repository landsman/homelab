.PHONY: help install typecheck test qa

.DEFAULT_GOAL := help
help: ## Show this list
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Quality checks

install: ## The actions' dependencies (ts-pattern, and tsc for the checks)
	bun install --frozen-lockfile

typecheck: ## Type-check the actions' scripts
	bun run typecheck

test: ## Test which changes each feature acts on
	bun run test

qa: typecheck test ## Everything CI runs here

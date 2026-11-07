.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Setup
.PHONY: install
install: ## install the pinned terraform, from mise.toml at the repo root
	mise install terraform

##@ Checks
.PHONY: fmt fmt-check validate ci
fmt: ## format every .tf file in place
	terraform fmt -recursive

fmt-check: ## fail on a .tf file terraform fmt would change
	terraform fmt -recursive -check

validate: ## validate without backend creds or remote state
	terraform init -backend=false
	terraform validate

ci: fmt-check validate ## what CI runs on a PR

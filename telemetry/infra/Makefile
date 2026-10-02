.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Checks
.PHONY: fmt fmt-check validate ci
fmt: ## format all .tf files in place
	terraform fmt

fmt-check: ## check formatting without writing
	terraform fmt -check

validate: ## validate without backend credentials or remote state
	terraform init -backend=false
	terraform validate

ci: fmt-check validate ## everything a pull request runs

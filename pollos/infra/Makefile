.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Setup, once per laptop
.PHONY: install
install: ## install the pinned terraform, from mise.toml at the repo root
	mise install terraform

##@ Checks
.PHONY: fmt fmt-check validate test ci
fmt: ## format every .tf file in place
	terraform fmt

fmt-check: ## fail on a .tf file terraform fmt would change
	terraform fmt -check

validate: ## validate without backend creds or remote state
	terraform init -backend=false
	terraform validate

# CI has no mise and passes SHELLCHECK=shellcheck, the runner's own.
SHELLCHECK ?= mise exec shellcheck -- shellcheck
test: ## shellcheck state.sh and run its test, no state or credentials needed
	$(SHELLCHECK) state.sh state.test.sh
	./state.test.sh

ci: fmt-check validate ## what CI runs on a PR

##@ Outputs, from the real state
# Each asks for the R2 credentials it reads the state with, from 1Password, typed without echo and
# kept nowhere (state.sh). Already in the environment, for instance under `op run`, they are not asked.
.PHONY: authkey forgejo-mcp-authkey authelia-authkey tunnel-tokens
# Never copy a key out of the terminal by eye: it is printed without a trailing newline, so zsh
# marks the end of the line with an inverse `%` that gets selected along with the key and makes
# it invalid. Capture it instead:
#   TS_AUTHKEY=$(make -s authkey)     # command substitution, always exact
#   make -s authkey | pbcopy          # straight to the clipboard
authkey: ## print the pollos boxes' Tailscale enrollment key, for setup/005-tailscale.sh
	@./state.sh output -raw tailscale_authkey

forgejo-mcp-authkey: ## print the forgejo-mcp sidecar's one login on the Pi (../../forgejo-mcp)
	@./state.sh output -raw forgejo_mcp_authkey

authelia-authkey: ## print the Authelia sidecar's one login on the Pi (../../authelia)
	@./state.sh output -raw authelia_authkey

tunnel-tokens: ## print the cloudflared tokens per node, for setup/003-monitoring.sh
	@./state.sh output -json health_tunnel_tokens

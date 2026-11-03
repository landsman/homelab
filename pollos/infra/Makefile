.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Checks
.PHONY: fmt fmt-check validate ci
fmt: ## format every .tf file in place
	terraform fmt

fmt-check: ## fail on a .tf file terraform fmt would change
	terraform fmt -check

validate: ## validate without backend creds or remote state
	terraform init -backend=false
	terraform validate

ci: fmt-check validate ## what CI runs on a PR

##@ Outputs, from the real state
.PHONY: init-remote authkey forgejo-mcp-authkey authelia-authkey tunnel-tokens
# Backend settings can't come from variables — Terraform resolves the backend before variables
# exist — so they go in backend.hcl, which is gitignored because it holds the R2 secret and the
# account id. See README; CI passes the same values inline instead.
#
# -reconfigure because `validate` inits with -backend=false; without it
# Terraform refuses to switch back with "Backend configuration changed".
init-remote: ## init against the R2 state; the targets below run it themselves
	@terraform init -reconfigure -backend-config=backend.hcl >&2

# Never copy a key out of the terminal by eye: it is printed without a trailing newline, so zsh
# marks the end of the line with an inverse `%` that gets selected along with the key and makes
# it invalid. Capture it instead:
#   TS_AUTHKEY=$(make -s authkey)     # command substitution, always exact
#   make -s authkey | pbcopy          # straight to the clipboard
authkey: init-remote ## print the pollos boxes' Tailscale enrollment key, for setup/005-tailscale.sh
	@terraform output -raw tailscale_authkey

forgejo-mcp-authkey: init-remote ## print the forgejo-mcp sidecar's one login on the Pi (../../forgejo-mcp)
	@terraform output -raw forgejo_mcp_authkey

authelia-authkey: init-remote ## print the Authelia sidecar's one login on the Pi (../../authelia)
	@terraform output -raw authelia_authkey

tunnel-tokens: init-remote ## print the cloudflared tokens per node, for setup/003-monitoring.sh
	@terraform output -json health_tunnel_tokens

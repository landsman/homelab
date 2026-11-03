.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Setup, once per laptop
.PHONY: install backend init-remote
install: ## install the pinned terraform, from mise.toml at the repo root
	mise install terraform

# Backend settings can't come from variables — Terraform resolves the backend before variables
# exist — so they go in backend.hcl, which is gitignored because it holds the R2 secret and the
# account id. CI passes the same values inline instead.
backend: ## make backend.hcl from the example, to fill from 1Password (README)
	@test -e backend.hcl || (umask 077 && cp backend.hcl.example backend.hcl)
	@grep -q '<' backend.hcl && echo "fill in backend.hcl: README, Reading state" || echo "backend.hcl is filled in"

# -reconfigure because `validate` inits with -backend=false; without it
# Terraform refuses to switch back with "Backend configuration changed".
init-remote: ## init against the R2 state; the output targets run it themselves
	@test -e backend.hcl || (echo "no backend.hcl; make backend first" >&2 && exit 1)
	@terraform init -reconfigure -backend-config=backend.hcl >&2

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
.PHONY: authkey forgejo-mcp-authkey authelia-authkey tunnel-tokens
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

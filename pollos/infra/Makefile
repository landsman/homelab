.PHONY: fmt fmt-check validate ci init-remote authkey tunnel-tokens

# Format all .tf files in place.
fmt:
	terraform fmt

# Check formatting without writing — use in CI.
fmt-check:
	terraform fmt -check

# Validate config without backend creds or remote state (CI on PRs).
validate:
	terraform init -backend=false
	terraform validate

# Full PR check — formatting + validation.
ci: fmt-check validate

# Init against the real R2 state, needed to read outputs. Backend settings can't
# come from variables — Terraform resolves the backend before variables exist —
# so they go in backend.hcl, which is gitignored because it holds the R2 secret
# and the account id. See README; CI passes the same values inline instead.
#
# -reconfigure because `validate` inits with -backend=false; without it
# Terraform refuses to switch back with "Backend configuration changed".
init-remote:
	@terraform init -reconfigure -backend-config=backend.hcl >&2

# Tailscale enrollment key for setup/005-tailscale.sh. Never copy this one out
# of the terminal by eye: it is printed without a trailing newline, so zsh marks
# the end of the line with an inverse `%` that gets selected along with the key
# and makes it invalid. Capture it instead:
#   TS_AUTHKEY=$(make -s authkey)     # command substitution, always exact
#   make -s authkey | pbcopy          # straight to the clipboard
authkey: init-remote
	@terraform output -raw tailscale_authkey

# Per-node cloudflared connector tokens for setup/003-monitoring.sh. Prints secrets.
tunnel-tokens: init-remote
	@terraform output -json health_tunnel_tokens

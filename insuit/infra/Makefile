.PHONY: fmt fmt-check validate ci

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

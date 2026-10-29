.DEFAULT_GOAL := help

# FORGEJO_MCP_HOST for user.ts: the same .env the containers read.
-include .env
export FORGEJO_MCP_HOST

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Container
.PHONY: up down logs
up: ## start
	docker compose up -d

down: ## stop
	docker compose down

logs: ## follow the logs
	docker compose logs -f

##@ Setup, on the Pi
.PHONY: secrets user integration code test
# Made here and printed nowhere. Copy the folder into 1Password once: losing `storage`
# makes the database unreadable, losing `oidc.pem` signs every device out.
secrets: ## generate the secrets Authelia needs, the ones missing
	@umask 077 && mkdir -p secrets && for f in jwt session storage oidc-hmac; do [ -s secrets/$$f ] || openssl rand -hex 32 >secrets/$$f; done
	@[ -s secrets/oidc.pem ] || (umask 077 && openssl genrsa -out secrets/oidc.pem 2048 2>/dev/null)
	@echo "secrets/ complete"

user: ## add USER with EMAIL; the password comes on stdin: op read … | make user USER=… EMAIL=…
	bun user.ts login $(USER) $(EMAIL)

integration: ## create USER's Forgejo integration and write forgejo_aud; forgejo-mcp must be up
	bun user.ts integration $(USER)

# Authelia sends the one-time code for registering a passkey or TOTP by "mail", which here
# is a file in its volume.
code: ## print the last one-time code Authelia sent
	docker exec authelia tail -n 20 /data/notification.txt

# The tooling (Bun types, oxfmt, oxlint) is the repository's, one level up.
test: ## format-check, lint, type-check and test user.ts
	@$(MAKE) -s -C .. qa

.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Container
.PHONY: up down logs build
up: ## build if needed and start
	docker compose up -d --build

down: ## stop
	docker compose down

logs: ## follow the logs
	docker compose logs -f

build: ## rebuild, after a version bump in compose.yml
	docker compose build --pull

##@ Setup, on the Pi
.PHONY: key
# The key forgejo-mcp signs its JWTs to Forgejo with. Whoever holds it acts as every user
# whose integration trusts this server, so it is made here and printed nowhere.
key: ## generate the signing key, if it is missing
	@[ -s secrets/signing.pem ] || (umask 077 && mkdir -p secrets && openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out secrets/signing.pem)
	@echo "secrets/signing.pem present"

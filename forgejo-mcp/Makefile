.DEFAULT_GOAL := help

LOCAL_PORT ?= 8005
SERVE_PATH ?= /forgejo-mcp
BOT_USER ?= landsman-mcp
SCOPES ?= read:user,write:repository,write:issue

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

build: ## rebuild, after bumping FORGEJO_MCP_VERSION in .env
	docker compose build --pull

##@ Account
# Run on the Pi: both go through Forgejo's CLI inside its container, the only way
# to make an account and a token without a password. The token is written into .env
# and printed nowhere, so it never leaves this box.
.PHONY: bot token
bot: ## create the bot account if it is missing
	BOT_USER=$(BOT_USER) ../forgejo/registry-bot.sh account

# Named by date: Forgejo refuses a token name twice, so a rotation needs a new one.
token: ## make a token for the bot and write it into .env
	@t=$$(docker exec -u git forgejo forgejo admin user generate-access-token --raw \
		--username $(BOT_USER) --token-name forgejo-mcp-$$(date +%F) --scopes $(SCOPES)) \
		&& sed -i "s|^FORGEJO_ACCESS_TOKEN=.*|FORGEJO_ACCESS_TOKEN=$$t|" .env && echo "token in .env"

##@ Tailnet
# Requires one-time `sudo tailscale set --operator=containers` so this user
# can run `tailscale serve` without sudo.
.PHONY: serve unserve serve-status
serve: ## publish on https://<pi>.<tailnet>.ts.net/forgejo-mcp
	tailscale serve --bg --https=443 --set-path=$(SERVE_PATH) http://localhost:$(LOCAL_PORT)/mcp

unserve: ## stop publishing
	tailscale serve --https=443 --set-path=$(SERVE_PATH) off

serve-status: ## show what tailscale serve publishes
	tailscale serve status

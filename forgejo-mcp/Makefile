.DEFAULT_GOAL := help

BOT_USER ?= michal
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

build: ## rebuild, after a version bump in compose.yml
	docker compose build --pull

##@ Account
# Run on the Pi: both go through Forgejo's CLI inside its container, the only way
# to make an account and a token without a password. The token is written into .env
# and printed nowhere, so it never leaves this box.
.PHONY: bot token
bot: ## create the bot account if it is missing
	BOT_USER=$(BOT_USER) ../forgejo/registry-bot.sh account

# Named by date: Forgejo refuses a token name twice, so a rotation needs a new one.
# The line is rewritten rather than edited in place, so a .env without it still gets
# it, and printf is a builtin, so the token never shows in another process's argv.
token: ## make a token for the bot and write it into .env
	@t=$$(docker exec -u git forgejo forgejo admin user generate-access-token --raw \
		--username $(BOT_USER) --token-name forgejo-mcp-$$(date +%F) --scopes $(SCOPES)) && umask 077 \
		&& { grep -v '^FORGEJO_ACCESS_TOKEN=' .env 2>/dev/null; printf 'FORGEJO_ACCESS_TOKEN=%s\n' "$$t"; } >.env.new \
		&& mv .env.new .env && echo "token in .env"

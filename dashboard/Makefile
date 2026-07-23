IMAGE          := homelab-dashboard
REGISTRY_IMAGE ?= ghcr.io/landsman/homelab-dashboard
TAG            ?= latest
PLATFORM       := linux/arm64
GIT_SHA        ?= $(shell git rev-parse --short HEAD)

### DEV
.PHONY: help dev install lock-regen build preview typecheck lint lint-fix shellcheck format format-check test qa

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^### /{printf "\n\033[1m%s\033[0m\n", substr($$0, 5)} /^[a-zA-Z_-]+:.*## /{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install deps
	npm ci

lock-regen: ## Regenerate package-lock.json with all-platform optional native deps (uses linux docker)
	rm -f package-lock.json
	docker run --rm -v "$$PWD":/app -w /app node:20-alpine \
		sh -c "rm -rf node_modules && npm install --include=optional --no-audit"
	@echo "✓ lockfile regenerated; run 'make install' to refresh local node_modules"

dev: ## Start local dev server (hot reload)
	npm run dev

dev-docker: ## Build + start Docker container (IP endpoints) then launch dev server
	docker compose up -d --build
	npm run dev

build: ## Build static assets into dist/
	npm run build

typecheck: ## Run TypeScript type checker
	npm run typecheck

lint: ## Run oxlint (includes filename-case check)
	npm run lint

lint-fix: ## Auto-fix oxlint issues
	npm run lint:fix

shellcheck: ## Run ShellCheck on docker/ and tests/deploy/ shell scripts
	shellcheck docker/*.sh tests/deploy/*.sh

test: ## Run unit tests
	npm test
	sh tests/deploy/run.sh

format: ## Format all files with Prettier
	npm run format:fix

format-check: ## Check formatting without writing
	npm run format

qa: shellcheck ## Run all quality checks (typecheck, format, lint, shellcheck, test)
	npm run typecheck
	npm run format
	npm run lint
	npm test
	sh tests/deploy/run.sh

preview: build ## Build then preview the production build locally
	npm run preview -- --port 4173

clean: ## Remove dist/ and node_modules/
	rm -rf dist node_modules

### RELEASE
.PHONY: docker-build ci-release

docker-build: ## Build Docker image for Raspberry Pi (linux/arm64)
	docker compose build

ci-release: ## Build linux/arm64 image and push to registry (set REGISTRY_IMAGE and GIT_SHA)
	docker buildx build \
		--platform $(PLATFORM) \
		--file docker/Dockerfile \
		--tag $(REGISTRY_IMAGE):$(TAG) \
		--tag $(REGISTRY_IMAGE):$(GIT_SHA) \
		--push \
		.

### DOCKER
.PHONY: run stop up down logs

run: ## Build and start via Docker Compose
	docker compose up -d --build

stop: ## Stop the running container
	docker compose stop

up: ## Run the container locally on PORT (default: 8080)
	REGISTRY_IMAGE=$(REGISTRY_IMAGE) TAG=$(TAG) docker compose up -d

down: ## Stop and remove Compose containers
	docker compose down

logs: ## Follow Compose logs
	docker compose logs -f

### TAILSCALE
.PHONY: serve unserve serve-status

LOCAL_PORT ?= 8080
SERVE_PATH ?= /dashboard

# Requires one-time `sudo tailscale set --operator=containers` so this user
# can run `tailscale serve` without sudo.
serve: ## Publish over tailnet HTTPS at $(SERVE_PATH)
	tailscale serve --bg --https=443 --set-path=$(SERVE_PATH) http://localhost:$(LOCAL_PORT)

unserve: ## Stop publishing over tailnet
	tailscale serve --https=443 --set-path=$(SERVE_PATH) off

serve-status: ## Show current tailscale serve config
	tailscale serve status

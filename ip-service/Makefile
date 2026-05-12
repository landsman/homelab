IMAGE                   := ip-service
REGISTRY_IMAGE          ?= ghcr.io/landsman/homelab-ip-service
TAG                     ?= latest
PLATFORM                := linux/arm64
GIT_SHA                 ?= $(shell git rev-parse --short HEAD)

### DEV
.PHONY: help install setup dev qa format

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install deps
	bun install --frozen-lockfile

setup: install ## Install deps and configure git hooks
	cd .. && git config core.hooksPath .githooks

dev: ## Start Bun server locally
	bun dev

qa: ## Run TypeScript type checker
	bun typecheck

format: ## Format all TypeScript files
	bun format

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
.PHONY: run up stop down logs

run: ## Build and start via Docker Compose
	docker compose up -d --build

up: ## Run the container locally
	REGISTRY_IMAGE=$(REGISTRY_IMAGE) TAG=$(TAG) docker compose up -d

stop: ## Stop containers
	docker compose stop

down: ## Stop and remove Compose containers
	docker compose down

logs: ## Follow logs
	docker logs -f $(IMAGE)

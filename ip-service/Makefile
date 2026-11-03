.DEFAULT_GOAL := help

IMAGE                   := ip-service
REGISTRY_IMAGE          ?= ghcr.io/landsman/homelab-ip-service
TAG                     ?= latest
PLATFORM                := linux/arm64
GIT_SHA                 ?= $(shell git rev-parse --short HEAD)

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Development
.PHONY: install setup dev qa format
install: ## install deps
	bun install --frozen-lockfile

setup: install ## install deps and configure git hooks
	cd .. && git config core.hooksPath .githooks

dev: ## start Bun server locally
	bun dev

qa: ## type-check and check formatting
	bun typecheck
	bun format:check

format: ## format all TypeScript files with oxfmt (config in the repo root .oxfmtrc.json)
	bun format

##@ Release
.PHONY: docker-build ci-release
docker-build: ## build Docker image for Raspberry Pi (linux/arm64)
	docker compose build

ci-release: ## build linux/arm64 image and push to registry (set REGISTRY_IMAGE and GIT_SHA)
	docker buildx build \
		--platform $(PLATFORM) \
		--file docker/Dockerfile \
		--tag $(REGISTRY_IMAGE):$(TAG) \
		--tag $(REGISTRY_IMAGE):$(GIT_SHA) \
		--push \
		.

##@ Container
.PHONY: run up stop down logs
run: ## build and start via Docker Compose
	docker compose up -d --build

up: ## run the container locally
	REGISTRY_IMAGE=$(REGISTRY_IMAGE) TAG=$(TAG) docker compose up -d

stop: ## stop containers
	docker compose stop

down: ## stop and remove Compose containers
	docker compose down

logs: ## follow logs
	docker logs -f $(IMAGE)

HOST = jesse.pollos

.PHONY: help rsync prepare config up down logs status register qemu

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

rsync: ## Copy this dir to the box (HOST=$(HOST))
	rsync -av --exclude data --exclude .env ./ $(HOST):forgejo-runner/

config: ## Copy the example config to runner/config.yml (run on the box, first time)
	@[ -f runner/config.yml ] || cp runner/config.example.yml runner/config.yml
	@echo "runner/config.yml ready — edit it and fill the UUID/Token"

prepare: ## chown data + write .env with the docker group gid (run on the box)
	mkdir -p data/.cache
	sudo chown -R 1001:1001 data
	chmod 775 data/.cache
	chmod g+s data/.cache
	@printf 'DOCKER_GID=%s\n' "$$(getent group docker | cut -d: -f3)" > .env
	@echo "Wrote .env with DOCKER_GID=$$(grep DOCKER_GID .env | cut -d= -f2)"

up: ## Start the runner
	docker compose up -d

down: ## Stop the runner
	docker compose down

logs: ## Follow runner logs
	docker compose logs -f

status: ## Show runner container state
	docker compose ps

register: ## Print registration steps (config-based, Forgejo 16)
	@echo "1. Forgejo UI -> Settings -> Actions -> Runners -> Create new runner"
	@echo "2. Fill the UUID and Token into runner/config.yml -> server.connections.forgejo"
	@echo "3. make rsync && ssh $(HOST) 'cd forgejo-runner && make prepare && make up'"

qemu: ## Register multiarch binfmt once (for cross-arch image builds)
	docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

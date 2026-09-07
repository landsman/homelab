HOST = jesse.pollos

.PHONY: help rsync prepare cache config up restart down logs status register qemu

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
	@$(MAKE) --no-print-directory cache

# Deliberately outside data/, which is chowned to the runner's uid. Job
# containers run as root and write here, so keeping the two apart avoids a
# directory owned by two users for two reasons.
CACHE_DIR = /home/ansible/forgejo-runner

cache: ## Create the job caches (mise toolchains, Gradle) and check the path
	@mkdir -p cache/mise cache/gradle
	@if [ "$(CURDIR)" != "$(CACHE_DIR)" ]; then \
		echo; \
		echo "WARNING: runner/config.example.yml mounts caches from $(CACHE_DIR),"; \
		echo "         but this checkout is at $(CURDIR)."; \
		echo "         Fix container.options in runner/config.yml, or the caches"; \
		echo "         will be written somewhere nothing reads them."; \
		echo; \
	else \
		echo "Job caches ready under $(CURDIR)/cache — matches the config."; \
	fi

up: ## Start the runner
	docker compose up -d

# `make up` does not apply a runner/config.yml change. compose only recreates a
# container when the *service definition* changes, and the config is a bind mount
# the daemon reads once at startup — so `up` reports "Running" and nothing has
# happened. `restart` is the one that picks it up, and it refuses while a job is
# in flight, because a restart takes the job container with it and the workflow
# then reports a failure that has nothing to do with the code.

restart: ## Restart the runner to pick up runner/config.yml changes
	@n=$$(docker ps --filter name=WORKFLOW -q | wc -l | tr -d ' '); \
	if [ "$$n" != "0" ]; then \
		echo "$$n job container(s) running — a restart kills them mid-job:"; \
		docker ps --filter name=WORKFLOW --format '  {{.Names}}  {{.Status}}'; \
		echo "Wait for them to finish, then run this again."; \
		exit 1; \
	fi
	docker compose restart

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
	@echo "   (later config edits need 'make restart', not 'make up')"

qemu: ## Register multiarch binfmt once (for cross-arch image builds)
	docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

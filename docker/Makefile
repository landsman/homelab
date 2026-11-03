.DEFAULT_GOAL := help

LOG_DIR := $(HOME)/logs/docker

VERSION = 0.24.4

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Tools
.PHONY: lazydocker
lazydocker: ## install lazydocker into ~/bin
	curl -Lo lazydocker.tar.gz "https://github.com/jesseduffield/lazydocker/releases/download/v$(VERSION)/lazydocker_$(VERSION)_Linux_arm64.tar.gz"
	tar xzf lazydocker.tar.gz lazydocker
	mkdir -p ~/bin && mv lazydocker ~/bin/
	rm lazydocker.tar.gz

##@ Housekeeping
.PHONY: prune guard-install cron-install
prune: ## system prune, preserve labeled containers
	@mkdir -p $(LOG_DIR)
	@docker system prune -f --filter "label!=preserve=true" 2>&1 | tee -a $(LOG_DIR)/docker-prune.log

guard-install: ## source docker-prune-guard.sh from ~/.bashrc
	@grep -q "docker-prune-guard.sh" $(HOME)/.bashrc 2>/dev/null \
		&& echo "Already installed in ~/.bashrc" \
		|| (echo "source $(PWD)/docker-prune-guard.sh" >> $(HOME)/.bashrc \
			&& echo "Added to ~/.bashrc. Run: source ~/.bashrc")

cron-install: ## install cron job to prune daily at 3:30am
	@crontab -l 2>/dev/null | grep -q "homelab/docker.*make prune" \
		&& (echo "Cron job already exists. To view: crontab -l | grep docker" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "30 3 * * * cd $(PWD) && make prune") | crontab -
	@echo "Cron job installed."

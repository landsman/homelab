LOG_DIR := $(HOME)/logs/docker

.PHONY: install lazydocker prune cron-install

VERSION = 0.24.4

lazydocker:
	curl -Lo lazydocker.tar.gz "https://github.com/jesseduffield/lazydocker/releases/download/v$(VERSION)/lazydocker_$(VERSION)_Linux_arm64.tar.gz"
	tar xzf lazydocker.tar.gz lazydocker
	mkdir -p ~/bin && mv lazydocker ~/bin/
	rm lazydocker.tar.gz

prune: ## System prune, preserve labeled containers
	@mkdir -p $(LOG_DIR)
	@docker system prune -f --filter "label!=preserve=true" 2>&1 | tee -a $(LOG_DIR)/docker-prune.log

cron-install: ## Install cron job to prune daily at 3:30am
	@crontab -l 2>/dev/null | grep -q "homelab/docker.*make prune" \
		&& (echo "Cron job already exists. To view: crontab -l | grep docker" && exit 1) \
		|| (crontab -l 2>/dev/null; echo "30 3 * * * cd $(PWD) && make prune") | crontab -
	@echo "Cron job installed."

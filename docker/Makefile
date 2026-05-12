LOG_DIR := $(HOME)/logs/docker

.PHONY: install lazydocker prune logrotate cron-install guard-install

VERSION = 0.24.4

lazydocker:
	curl -Lo lazydocker.tar.gz "https://github.com/jesseduffield/lazydocker/releases/download/v$(VERSION)/lazydocker_$(VERSION)_Linux_arm64.tar.gz"
	tar xzf lazydocker.tar.gz lazydocker
	mkdir -p ~/bin && mv lazydocker ~/bin/
	rm lazydocker.tar.gz

prune: ## System prune, preserve labeled containers
	@mkdir -p $(LOG_DIR)
	@docker system prune -f --filter "label!=preserve=true" 2>&1 | tee -a $(LOG_DIR)/docker-prune.log

guard-install: ## Source docker-prune-guard.sh from ~/.bashrc
	@grep -q "docker-prune-guard.sh" $(HOME)/.bashrc 2>/dev/null \
		&& echo "Already installed in ~/.bashrc" \
		|| (echo "source $(PWD)/docker-prune-guard.sh" >> $(HOME)/.bashrc \
			&& echo "Added to ~/.bashrc. Run: source ~/.bashrc")

logrotate: ## Rotate logs in ~/logs/docker (keeps 4 weekly gzipped archives)
	@mkdir -p $(LOG_DIR)
	@cd $(LOG_DIR) && for f in *.log; do \
		[ -f "$$f" ] || continue; \
		[ -s "$$f" ] || continue; \
		[ -f "$$f.4.gz" ] && rm "$$f.4.gz"; \
		for n in 3 2 1; do \
			[ -f "$$f.$$n.gz" ] && mv "$$f.$$n.gz" "$$f.$$(($$n+1)).gz"; \
		done; \
		cp "$$f" "$$f.1" && gzip -f "$$f.1" && : > "$$f"; \
	done
	@echo "Rotated logs in $(LOG_DIR)."

cron-install: ## Install docker cron jobs (system prune, log rotation)
	@( crontab -l 2>/dev/null \
	     | grep -v "homelab/docker.*make prune" \
	     | grep -v "homelab/docker.*make logrotate"; \
	   echo "30 3 * * * cd \"$(PWD)\" && make prune"; \
	   echo "0 1 * * 0 cd \"$(PWD)\" && make logrotate" ) | crontab -
	@echo "Cron jobs installed: prune (03:30 daily), logrotate (01:00 Sunday)."

# `include ../pi.mk` in an app's Makefile: the targets that reach the Pi from the laptop.
# Last in the file, since make help lists an included file after the one including it.

##@ From the laptop
.PHONY: rsync
# The apps belong to containers, and live under its ~/dev, the RAID (docker/README.md).
PI ?= containers@nas.local
PI_DIR ?= dev/apps/$(notdir $(CURDIR))

# The Pi has no checkout, so its copy is the tracked files only; .env, secrets/ and whatever
# else lives there alone are never in the list and never overwritten.
rsync: ## copy this folder's tracked files to the Pi (PI=<ssh host> to override)
	@ssh $(PI) 'mkdir -p $(PI_DIR)'
	git ls-files -z . | rsync -av --from0 --files-from=- ./ $(PI):$(PI_DIR)/

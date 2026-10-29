.DEFAULT_GOAL := help

# The scripts that are not an app of their own. The apps (dashboard, insuit, ip-service)
# have their own Makefile, package.json and checks; .oxfmtrc.json here is shared by all.
SCRIPTS := authelia

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Scripts outside the apps
.PHONY: install format format-check lint typecheck test qa
install: ## install the Bun types, oxfmt and oxlint
	@bun install --frozen-lockfile --ignore-scripts >/dev/null

format: install ## format the scripts with oxfmt
	@bun x oxfmt $(SCRIPTS)

format-check: install ## fail on a script oxfmt would change
	@bun x oxfmt --check $(SCRIPTS)

lint: install ## lint the scripts with oxlint
	@bun x oxlint $(SCRIPTS)

typecheck: install ## type-check the scripts
	@bun check --no-pretty $(SCRIPTS)

test: install ## run the scripts' tests
	@bun test $(SCRIPTS)

qa: format-check lint typecheck test ## everything CI runs on the scripts

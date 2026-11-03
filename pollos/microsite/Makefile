.DEFAULT_GOAL := help

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Setup
.PHONY: install bootstrap login bucket
install: ## install pinned toolchain via mise
	mise install

bootstrap: install login bucket ## first-time setup: install + cloudflare login + create R2 bucket

login: ## log in to Cloudflare (wrangler)
	mise exec -- wrangler login

bucket: ## create the R2 bucket for terraform state
	mise exec -- wrangler r2 bucket create pollos-cz-tf-state

##@ Build
.PHONY: clean copy pages build dev
# Wipe the build artifact directory.
clean: ## wipe the build artifact dir (public/)
	rm -rf public

# Copy static source into the artifact dir.
# /index.html is a body fragment for the home page — wrapped by gen-index.sh,
# never shipped raw.
copy: clean ## copy static source into public/
	mkdir -p public
	rsync -aL --exclude='/index.html' src/ public/

# Render all pages by wrapping content in templates/layout.html.
pages: copy ## render pages into templates/layout.html
	@./cli/pages.sh

# Full build — run before `wrangler pages deploy`.
build: pages ## full build (run before `wrangler pages deploy`)

# Serve the built site locally and rebuild on source changes.
dev: ## serve locally, rebuild on change
	@./cli/dev.sh

##@ Checks
.PHONY: test version lint format format-check
# Smoke-test the generator: build into public/ and assert its invariants.
test: ## run generator smoke tests
	@sh tests/run.sh

# Print versions of tooling so CI logs (and humans) can pin them at a glance.
# Missing tools print "n/a" — never fails.
version: ## print tooling versions
	@./cli/version.sh

# Lint bash scripts with shellcheck (-x follows `source` directives) and
# JS with oxlint (Rust, ~50× faster than ESLint; runs eslint-plugin-jsdoc
# via oxlint's JS Plugins to enforce JSDoc on function declarations).
# Config lives in .oxlintrc.json.
lint: ## lint shell (shellcheck) + JS (oxlint)
	shellcheck -x cli/*.sh src/setup/*.sh
	@npx oxlint

# Format CSS, HTML, JS and JSON with oxfmt (config in the repo root .oxfmtrc.json).
format: ## format files with oxfmt
	npm run format:fix

# Check formatting without writing — use in CI.
format-check: ## check formatting without writing (CI)
	npm run format

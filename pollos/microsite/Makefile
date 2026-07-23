### HELP
.PHONY: help install bootstrap login bucket clean copy pages build dev test lint format format-check version

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^### /{printf "\n\033[1m%s\033[0m\n", substr($$0, 5)} /^[a-zA-Z_-]+:.*## /{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

### SETUP
install: ## Install pinned toolchain via mise
	mise install

bootstrap: install login bucket ## First-time setup: install + cloudflare login + create R2 bucket

login: ## Log in to Cloudflare (wrangler)
	mise exec -- wrangler login

bucket: ## Create the R2 bucket for terraform state
	mise exec -- wrangler r2 bucket create pollos-cz-tf-state

### BUILD
# Wipe the build artifact directory.
clean: ## Wipe the build artifact dir (public/)
	rm -rf public

# Copy static source into the artifact dir.
# /index.html is a body fragment for the home page — wrapped by gen-index.sh,
# never shipped raw.
copy: clean ## Copy static source into public/
	mkdir -p public
	rsync -aL --exclude='/index.html' src/ public/

# Render all pages by wrapping content in templates/layout.html.
pages: copy ## Render pages into templates/layout.html
	@./cli/pages.sh

# Full build — run before `wrangler pages deploy`.
build: pages ## Full build (run before `wrangler pages deploy`)

# Serve the built site locally and rebuild on source changes.
dev: ## Serve locally, rebuild on change
	@./cli/dev.sh

### QA
# Smoke-test the generator: build into public/ and assert its invariants.
test: ## Run generator smoke tests
	@sh tests/run.sh

# Print versions of tooling so CI logs (and humans) can pin them at a glance.
# Missing tools print "n/a" — never fails.
version: ## Print tooling versions
	@./cli/version.sh

# Lint bash scripts with shellcheck (-x follows `source` directives) and
# JS with oxlint (Rust, ~50× faster than ESLint; runs eslint-plugin-jsdoc
# via oxlint's JS Plugins to enforce JSDoc on function declarations).
# Config lives in .oxlintrc.json.
lint: ## Lint shell (shellcheck) + JS (oxlint)
	shellcheck -x cli/*.sh src/setup/*.sh
	@npx oxlint

# Format CSS, HTML, JS and JSON with Prettier (config in .prettierrc).
format: ## Format files with Prettier
	npm run format:fix

# Check formatting without writing — use in CI.
format-check: ## Check formatting without writing (CI)
	npm run format

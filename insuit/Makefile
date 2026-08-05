.PHONY: help install bucket dev og format lint qa

# Bare `make` lists the targets. Each one's `##` comment is its description —
# there is no second list to keep in sync.
.DEFAULT_GOAL := help
help: ## Show this list
	@grep -hE '^[a-z][a-z-]*:.*##' $(MAKEFILE_LIST) \
	  | awk -F':.*## ' '{printf "  make %-8s %s\n", $$1, $$2}'

# npm deps + the OG fonts. Fira Mono comes from the @fontsource npm package
# rather than being committed under og/ — the two weights are symlinked in
# (gitignored), so no font is stored in the repo for the card. The render
# browser is pulled by `make og`, not here, so this stays fast for CI's
# format/lint job.
install: ## npm deps, plus the OG card's font symlinks
	npm install --no-audit --no-fund
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-400-normal.woff2 \
	  og/fira-mono-latin-400-normal.woff2
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-700-normal.woff2 \
	  og/fira-mono-latin-700-normal.woff2

# Render the Open Graph card (og/og.html) to a PNG with Playwright's headless
# Chromium — maintained (Microsoft), provider-independent, runs locally and in
# CI. Not committed: CI regenerates it and hands it to the deploy as an
# artifact (see .github/workflows/insuit-deploy.yml). Run this to preview.
og: ## Render the Open Graph card to site/assets/icons/
	npx playwright install chromium
	npx playwright screenshot --viewport-size="1200,630" --wait-for-timeout=1500 \
	  "file://$(CURDIR)/og/og.html" site/assets/icons/og-image.png
	@echo "wrote site/assets/icons/og-image.png"

# One-time: create the R2 bucket holding Terraform state. Needs `wrangler login`
# first. npx rather than a devDependency — this runs once, ever.
bucket: ## Create the R2 bucket for Terraform state (once, ever)
	npx wrangler r2 bucket create insuit-cz-tf-state

# Serve site/ locally — stdlib http.server, nothing to install.
dev: ## Serve site/ on http://localhost:4321
	cd site && python3 -m http.server 4321

format: ## Format everything with oxfmt
	npm run format:fix

# oxlint with eslint-plugin-jsdoc, enforcing JSDoc on function declarations.
lint: ## Lint the JS with oxlint
	npm run lint

qa: ## Run all quality checks (format, lint)
	npm run format
	npm run lint

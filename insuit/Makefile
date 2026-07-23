.PHONY: install bucket dev og format lint qa

# npm deps, the OG fonts, and the render browser. Fira Mono comes from the
# @fontsource npm package rather than being committed under og/ — the two
# weights are symlinked in (gitignored), so no font is stored in the repo for
# the OG card. Playwright's chromium is what `make og` renders with.
install:
	npm install --no-audit --no-fund
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-400-normal.woff2 \
	  og/fira-mono-latin-400-normal.woff2
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-700-normal.woff2 \
	  og/fira-mono-latin-700-normal.woff2
	npx playwright install chromium

# Render the Open Graph card (og/og.html) to a PNG with Playwright's headless
# Chromium — maintained (Microsoft), provider-independent, runs locally and in
# CI. Not committed: CI regenerates it and hands it to the deploy as an
# artifact (see .github/workflows/insuit-deploy.yml). Run this to preview.
og:
	npx playwright screenshot --viewport-size="1200,630" --wait-for-timeout=1500 \
	  "file://$(CURDIR)/og/og.html" site/assets/icons/og-image.png
	@echo "wrote site/assets/icons/og-image.png"

# One-time: create the R2 bucket holding Terraform state. Needs `wrangler login`
# first. npx rather than a devDependency — this runs once, ever.
bucket:
	npx wrangler r2 bucket create insuit-cz-tf-state

# Serve site/ locally — stdlib http.server, nothing to install.
dev:
	cd site && python3 -m http.server 4321

format:
	npm run format:fix

# oxlint with eslint-plugin-jsdoc, enforcing JSDoc on function declarations.
lint:
	npm run lint

qa: ## Run all quality checks (format, lint)
	npm run format
	npm run lint

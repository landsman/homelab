.PHONY: help install dev build preview clean
.PHONY: typecheck lint lint-fix format format-check images test browser e2e-deps e2e e2e-head bdd qa
.PHONY: og bucket

# Bare `make` lists the targets. Each one's `##` comment is its description,
# each `##@` line opens a section — there is no second list to keep in sync.
.DEFAULT_GOAL := help
help: ## Show this list
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Development

# npm deps + the OG fonts. Fira Mono comes from the @fontsource npm package
# rather than being committed under og/ — the two weights are symlinked in
# (gitignored), so no font is stored in the repo for the card. The browser is
# pulled by `make og` and `make e2e`, not here, so this stays fast.
install: ## npm deps, plus the OG card's font symlinks
	npm ci --no-audit --no-fund
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-400-normal.woff2 \
	  og/fira-mono-latin-400-normal.woff2
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-700-normal.woff2 \
	  og/fira-mono-latin-700-normal.woff2

dev: ## Start the dev server on http://localhost:4321 (hot reload, cv.md included)
	npm run dev

# Every page is rendered to an HTML file here. The CV is built here too:
# src/features/cv/cv.md becomes the page's data and the printed QR codes
# (vite/cv.ts), and a CV link with no short link in links/_redirects stops the
# build.
build: ## Build the site into dist/client — what gets deployed
	npm run build

# Cloudflare's own asset server rather than a plain static one: it is what
# resolves /contact to contact.html and answers an unknown address with
# 404.html. The e2e and Cucumber suites run against this, not the dev server.
preview: build ## Build, then serve it the way Pages does, http://localhost:8788
	npm run preview

clean: ## Remove everything a build or an install wrote
	rm -rf dist node_modules src/paraglide public/assets/cv-qr.svg .tanstack

##@ Quality assurance

typecheck: ## Run the TypeScript type checker
	npm run typecheck

lint: ## Run oxlint (includes the filename-case check)
	npm run lint

lint-fix: ## Auto-fix oxlint issues
	npm run lint:fix

format: ## Format everything with oxfmt
	npm run format:fix

format-check: ## Check formatting without writing
	npm run format

# The CV's images stay under 150 KB each: a screenshot saved at full size is
# how a page gets heavy without anyone noticing. Over the cap, re-encode it —
# `djpeg | cjpeg -quality 80 -optimize -progressive` for a JPEG, `cwebp` for
# a screenshot — rather than raising the cap.
images: ## Fail if a CV image is over 150 KB
	@big=$$(find public/assets/cv -type f -size +150k); \
	  if [ -n "$$big" ]; then echo "over 150 KB:"; echo "$$big"; exit 1; fi

test: ## Run unit tests
	npm test

browser: ## Install the Playwright browser if it is missing
	npx playwright install chromium

e2e-deps: ## The browser plus its system libraries — what a fresh CI runner needs
	npx playwright install --with-deps chromium

e2e: browser ## Run Playwright end-to-end tests (builds and serves the site itself)
	npm run test:e2e

# One worker, one window, a pause between actions — otherwise it is six Chromes
# racing each other too fast to read. SLOW_MO also turns on the on-screen label
# naming the running test (see tests/e2e/fixture.ts).
SLOW_MO ?= 900

e2e-head: browser ## Same in one visible browser at watchable speed (SLOW_MO=ms, ARGS="--debug")
	SLOW_MO=$(SLOW_MO) npm run test:e2e -- --headed --workers=1 $(ARGS)

bdd: browser ## Run the Cucumber feature files (HEADED=1 SLOW_MO=500 to watch them)
	npm run test:bdd

qa: images ## Run all quality checks (images, typecheck, format, lint, test)
	npm run typecheck
	npm run format
	npm run lint
	npm test

##@ Release

# Render the Open Graph card (og/og.html) to a PNG with Playwright's headless
# Chromium — maintained (Microsoft), provider-independent, runs locally and in
# CI. Not committed: CI regenerates it and hands it to the deploy as an
# artifact (see .github/workflows/insuit-deploy.yml). Run this to preview.
og: browser ## Render the Open Graph card to public/assets/icons/
	npx playwright screenshot --viewport-size="1200,630" --wait-for-timeout=1500 \
	  "file://$(CURDIR)/og/og.html" public/assets/icons/og-image.png
	@echo "wrote public/assets/icons/og-image.png"

# One-time: create the R2 bucket holding Terraform state. Needs `wrangler login`
# first. npx rather than a devDependency — this runs once, ever.
bucket: ## Create the R2 bucket for Terraform state (once, ever)
	npx wrangler r2 bucket create insuit-cz-tf-state

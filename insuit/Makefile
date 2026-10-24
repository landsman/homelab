.PHONY: help install dev build preview clean
.PHONY: typecheck lint lint-fix format format-check images test browser e2e-deps e2e e2e-head bdd smoke qa
.PHONY: og bucket

# Bare `make` lists the targets. Each one's `##` comment is its description,
# each `##@` line opens a section — there is no second list to keep in sync.
.DEFAULT_GOAL := help
help: ## Show this list
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Development

# Bun is the one tool: it installs, runs every script and is the runtime they
# run on (bunfig.toml). Nothing here needs Node.
#
# The deps + the OG fonts. Fira Mono comes from the @fontsource npm package
# rather than being committed under og/ — the two weights are symlinked in
# (gitignored), so no font is stored in the repo for the card. The browser is
# pulled by `make og` and `make e2e`, not here, so this stays fast.
# Also points git at the repo's hooks, so the format gate in
# .githooks/pre-commit runs from the first commit in a new worktree.
install: ## The dependencies, the OG card's font symlinks and the git hooks
	bun install --frozen-lockfile
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-400-normal.woff2 \
	  og/fira-mono-latin-400-normal.woff2
	ln -sf ../node_modules/@fontsource/fira-mono/files/fira-mono-latin-700-normal.woff2 \
	  og/fira-mono-latin-700-normal.woff2
	git config core.hooksPath .githooks

dev: ## Start the dev server on http://localhost:4321 (hot reload, cv.md included)
	bun run dev

# Every page is rendered to an HTML file here. The CV is built here too:
# content/cv/cv.md becomes the page's data and the printed QR codes
# (vite/cv.ts), and a CV link with no short link in links/_redirects stops the
# build.
build: ## Build the site into dist/client — what gets deployed
	bun run build

# Not a plain static server: scripts/preview.ts follows Pages' rules, which is
# what resolves /contact to contact.html and answers an unknown address with
# 404.html. The e2e and Cucumber suites run against this, not the dev server.
preview: build ## Build, then serve it the way Pages does, http://localhost:8788
	bun run preview

clean: ## Remove everything a build or an install wrote
	rm -rf dist node_modules src/paraglide public/assets/cv-qr.svg public/assets/cv-thumbs .tanstack

##@ Quality assurance

typecheck: ## Run the TypeScript type checker
	bun run typecheck

lint: ## Run oxlint (includes the filename-case check)
	bun run lint

lint-fix: ## Auto-fix oxlint issues
	bun run lint:fix

format: ## Format everything with oxfmt
	bun run format:fix

format-check: ## Check formatting without writing
	bun run format

# The CV's images stay under 150 KB each: a screenshot saved at full size is
# how a page gets heavy without anyone noticing. Over the cap, re-encode it —
# `djpeg | cjpeg -quality 80 -optimize -progressive` for a JPEG, `cwebp` for
# a screenshot — rather than raising the cap.
images: ## Fail if a CV image is over 150 KB
	@big=$$(find public/assets/cv -type f -size +150k); \
	  if [ -n "$$big" ]; then echo "over 150 KB:"; echo "$$big"; exit 1; fi

test: ## Run unit tests
	bun run test

shell: ## shellcheck the scripts, and test the decisions CI makes with them
	shellcheck scripts/*.sh
	scripts/preview-comment.test.sh
	scripts/app-changed.test.sh

browser: ## Install the Playwright browser if it is missing
	bunx playwright install chromium

e2e-deps: ## The browser plus its system libraries (apt) — for a bare Linux machine; CI does not need it
	bunx playwright install --with-deps chromium

e2e: browser ## Run Playwright end-to-end tests (builds and serves the site itself)
	bun run test:e2e

# One worker, one window, a pause between actions — otherwise it is six Chromes
# racing each other too fast to read. SLOW_MO also turns on the on-screen label
# naming the running test (see tests/e2e/fixture.ts).
SLOW_MO ?= 900

e2e-head: browser ## Same in one visible browser at watchable speed (SLOW_MO=ms, ARGS="--debug")
	SLOW_MO=$(SLOW_MO) bun run test:e2e --headed --workers=1 $(ARGS)

bdd: browser ## Run the Cucumber feature files (HEADED=1 SLOW_MO=500 to watch them)
	bun run test:bdd

# The live sites, not a local build — see playwright.smoke.config.ts. No
# browser: plain HTTP. SMOKE_URL picks the site, SMOKE_COMMIT waits for a
# deploy, ARGS="--project=site" narrows it.
smoke: ## Ask the live sites, short links and their targets what a visitor would
	bun run test:smoke $(ARGS)

qa: images ## Run all quality checks (images, typecheck, format, lint, test, shell)
	bun run typecheck
	bun run format
	bun run lint
	bun run test
	$(MAKE) shell

##@ Release

# Render the Open Graph card (og/og.html) to a PNG with Playwright's headless
# Chromium — maintained (Microsoft), provider-independent, runs locally and in
# CI. Not committed: CI regenerates it and hands it to the deploy as an
# artifact (see .github/workflows/insuit-deploy.yml). Run this to preview.
og: browser ## Render the Open Graph card to public/assets/icons/
	bunx playwright screenshot --viewport-size="1200,630" --wait-for-timeout=1500 \
	  "file://$(CURDIR)/og/og.html" public/assets/icons/og-image.png
	@echo "wrote public/assets/icons/og-image.png"

# One-time: create the R2 bucket holding Terraform state. Needs `wrangler login`
# first. bunx rather than a devDependency — this runs once, ever.
bucket: ## Create the R2 bucket for Terraform state (once, ever)
	bunx wrangler r2 bucket create insuit-cz-tf-state

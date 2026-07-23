.PHONY: install bucket dev og format lint qa

# npm deps + the OG font symlink. The 400 weight already ships in site/; rather
# than duplicate the file, og/ links to it (the 700 weight lives only in og/,
# so it's a real file there). Symlink is gitignored — this recreates it.
install:
	npm install --no-audit --no-fund
	ln -sf ../site/assets/fonts/fira-mono-latin-400-normal.woff2 \
	  og/fira-mono-latin-400-normal.woff2

# Render the Open Graph card (og/og.html) to the shipped PNG, via headless
# Chromium in Docker — provider-independent and reproducible, no local browser.
# CI regenerates this on any og/ change (see .github/workflows/insuit-og.yml);
# run it locally to preview. Mounts the whole dir so the font symlink resolves.
OG_RENDER_IMAGE ?= zenika/alpine-chrome@sha256:beefd07cbbee1dfd5d6c3b31274db46a1d9ea1611025f4de01f1f6cbcfcc8af2
og:
	docker run --rm \
	  -v "$(CURDIR)":/work:ro -v "$(CURDIR)/site/assets/icons":/out \
	  $(OG_RENDER_IMAGE) \
	  --no-sandbox --headless --disable-gpu --hide-scrollbars \
	  --force-device-scale-factor=1 --window-size=1200,630 \
	  --default-background-color=00000000 --virtual-time-budget=5000 \
	  --screenshot=/out/og-image.png "file:///work/og/og.html"
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

.PHONY: install bucket dev og format lint qa

install:
	npm install --no-audit --no-fund

# Render the Open Graph card from og/og.html to the shipped PNG, via headless
# Chrome (macOS path). Edit og/og.html, run this, commit the PNG. Self-contained
# — no dev server needed; Chrome loads the file directly.
CHROME ?= /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
og:
	"$(CHROME)" --headless --disable-gpu --hide-scrollbars \
	  --force-device-scale-factor=1 --window-size=1200,630 \
	  --default-background-color=00000000 --virtual-time-budget=5000 \
	  --screenshot="$(CURDIR)/site/assets/icons/og-image.png" \
	  "file://$(CURDIR)/og/og.html"
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

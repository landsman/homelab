.PHONY: install bucket dev format lint qa

install:
	npm install --no-audit --no-fund

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

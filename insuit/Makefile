.PHONY: install dev format lint qa

install:
	npm install --no-audit --no-fund

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

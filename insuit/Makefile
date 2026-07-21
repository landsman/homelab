.PHONY: install dev format qa

install:
	npm install --no-audit --no-fund

# Serve site/ locally — stdlib http.server, nothing to install.
dev:
	cd site && python3 -m http.server 4321

format:
	npm run format:fix

qa: ## Run all quality checks (format)
	npm run format

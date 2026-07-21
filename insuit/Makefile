.PHONY: install dev format format-check ci

install:
	npm install --no-audit --no-fund

# Serve site/ locally — stdlib http.server, nothing to install.
dev:
	cd site && python3 -m http.server 4321

format:
	npm run format:fix

# Check formatting without writing — use in CI.
format-check:
	npm run format

ci: format-check

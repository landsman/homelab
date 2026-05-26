.PHONY: install dev deploy tail typecheck format format-check

# Install pinned tools (node + wrangler via mise) and npm dev deps.
install:
	mise install
	npm install

# Run the Worker + Durable Object locally (ws://localhost:8787/cursors).
dev:
	mise exec -- wrangler dev

# Deploy the Worker to Cloudflare. CI does this in the `worker` job; run by hand
# for a manual push. Custom domain microsite-ws.pollos.cz lives in pollos/infra.
deploy:
	mise exec -- wrangler deploy

# Stream live logs from the deployed Worker.
tail:
	mise exec -- wrangler tail

# Type-check without emitting.
typecheck:
	npm run typecheck

# Format source with Prettier (config in .prettierrc).
format:
	npm run format

# Check formatting without writing — use in CI.
format-check:
	npm run format:check
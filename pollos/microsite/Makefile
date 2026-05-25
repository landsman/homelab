.PHONY: install bootstrap login bucket clean copy pages build dev lint format format-check version

install:
	mise install

bootstrap: install login bucket

login:
	mise exec -- wrangler login

bucket:
	mise exec -- wrangler r2 bucket create pollos-cz-tf-state

# Wipe the build artifact directory.
clean:
	rm -rf public

# Copy static source into the artifact dir.
# /index.html is a body fragment for the home page — wrapped by gen-index.sh,
# never shipped raw.
copy: clean
	mkdir -p public
	rsync -aL --exclude='/index.html' src/ public/

# Render all pages by wrapping content in templates/layout.html.
pages: copy
	@./cli/pages.sh

# Full build — run before `wrangler pages deploy`.
build: pages

# Serve the built site locally and rebuild on source changes.
dev:
	@./cli/dev.sh

# Print versions of tooling so CI logs (and humans) can pin them at a glance.
# Missing tools print "n/a" — never fails.
version:
	@./cli/version.sh

# Lint bash scripts with shellcheck (-x follows `source` directives) and
# JS with oxlint (Rust, ~50× faster than ESLint; runs eslint-plugin-jsdoc
# via oxlint's JS Plugins to enforce JSDoc on function declarations).
# Config lives in .oxlintrc.json.
lint:
	shellcheck -x cli/*.sh src/setup/*.sh
	@npx oxlint

# Format CSS, HTML, JS and JSON with Prettier (config in .prettierrc).
format:
	npm run format:fix

# Check formatting without writing — use in CI.
format-check:
	npm run format

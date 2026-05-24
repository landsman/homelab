.PHONY: install bootstrap login bucket clean copy pages build dev lint version

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
version:
	@printf "%-12s %s\n" "node"       "$$(node --version 2>/dev/null || echo 'n/a')"
	@printf "%-12s %s\n" "python3"    "$$(python3 --version 2>/dev/null | awk '{print $$2}')"
	@printf "%-12s %s\n" "shellcheck" "$$(shellcheck --version 2>/dev/null | awk '/^version:/ {print $$2}')"
	@printf "%-12s %s\n" "wrangler"   "$$(wrangler --version 2>&1 | awk '/wrangler/ {print $$NF; exit}')"
	@printf "%-12s %s\n" "rsync"      "$$(rsync --version 2>/dev/null | head -1 | awk '{print $$3}')"

# Lint every bash script with shellcheck.
# -x makes shellcheck follow `source` directives (e.g. lib-render.sh).
lint:
	shellcheck -x cli/*.sh src/setup/*.sh

.PHONY: install bootstrap login bucket clean copy pages build dev

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

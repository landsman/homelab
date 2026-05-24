.PHONY: install bootstrap login bucket

install:
	mise install

bootstrap: install login bucket

login:
	mise exec -- wrangler login

bucket:
	mise exec -- wrangler r2 bucket create pollos-cz-tf-state

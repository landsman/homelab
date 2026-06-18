MODEL = large-v3-turbo-q8_0
HOST = walter.pollos

.PHONY: help rsync build model up down logs status

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

rsync: ## Copy this dir to the box (HOST=walter.pollos)
	rsync -av --exclude models ./ $(HOST):whisper/

build: ## Build the whisper-server image (run on the box)
	docker compose build

model: ## Download the ggml model (~874 MB) into ./models
	mkdir -p models
	@if [ -f models/ggml-$(MODEL).bin ]; then \
		echo "Model ggml-$(MODEL).bin already present — skipping download."; \
	else \
		curl -fL -o models/ggml-$(MODEL).bin.tmp \
			https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$(MODEL).bin && \
		mv models/ggml-$(MODEL).bin.tmp models/ggml-$(MODEL).bin; \
	fi

up: ## Start the server (healthy once the model is loaded)
	docker compose up -d

down: ## Stop the server, free RAM
	docker compose down

logs: ## Follow server logs
	docker compose logs -f

status: ## Show container state + health
	docker compose ps

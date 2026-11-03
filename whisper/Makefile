.DEFAULT_GOAL := help

MODEL = large-v3-turbo-q8_0
HOST = walter.pollos

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Server
.PHONY: rsync build model up down logs status
rsync: ## copy this dir to the box (HOST=walter.pollos)
	rsync -av --exclude models ./ $(HOST):whisper/

build: ## build the whisper-server image (run on the box)
	docker compose build

model: ## download the ggml model (~874 MB) into ./models
	mkdir -p models
	@if [ -f models/ggml-$(MODEL).bin ]; then \
		echo "Model ggml-$(MODEL).bin already present — skipping download."; \
	else \
		curl -fL -o models/ggml-$(MODEL).bin.tmp \
			https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$(MODEL).bin && \
		mv models/ggml-$(MODEL).bin.tmp models/ggml-$(MODEL).bin; \
	fi

up: ## start the server (healthy once the model is loaded)
	docker compose up -d

down: ## stop the server, free RAM
	docker compose down

logs: ## follow server logs
	docker compose logs -f

status: ## show container state + health
	docker compose ps

##@ Transcription
.PHONY: cluster
cluster: ## transcribe one file across all boxes (FILE=path/to/audio)
	@test -n "$(FILE)" || { echo "usage: make cluster FILE=path/to/audio"; exit 1; }
	./transcribe-cluster.sh "$(FILE)"

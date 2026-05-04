.PHONY: up down logs pull restart serve unserve serve-status

LOCAL_PORT ?= 8003
SERVE_PATH ?= /yt-archive

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

pull:
	docker compose pull

restart:
	docker compose restart

serve:
	tailscale serve --bg --https=443 --set-path=$(SERVE_PATH) http://localhost:$(LOCAL_PORT)

unserve:
	tailscale serve --https=443 --set-path=$(SERVE_PATH) off

serve-status:
	tailscale serve status

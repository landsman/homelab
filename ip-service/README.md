# IP Service

A standalone Bun microservice for IP and header detection. 
It mimics the behavior of a Cloudflare Worker but is rewritten in TypeScript and designed to run in any environment with Bun (e.g., Docker, Raspberry Pi).

## Features

- Returns visitor's real IP address (resolves standard `X-Real-IP` and `X-Forwarded-For` headers)
- `/`: Returns the plain text IP address
- `/json`: Returns all request headers as a JSON object
- `/headers` / `/more`: Returns all request headers in plain text format
- Type safety with TypeScript

## Development

```bash
make dev           # run server locally using Bun on port 3000
make typecheck     # run TypeScript type checker
make run           # build and run in Docker locally
make logs          # follow docker logs
make stop          # stop and remove docker container
```

## Build & Release

```bash
make build       # build Docker image for current platform
make ci-release         # build and push linux/arm64 image to registry
```

The service is designed to be proxied by Nginx or another reverse proxy that sets the appropriate `X-Real-IP` headers.

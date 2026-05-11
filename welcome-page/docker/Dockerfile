# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:25-alpine AS builder

RUN apk add --no-cache make

WORKDIR /app

COPY package.json package-lock.json* Makefile ./
RUN make install

COPY . .
RUN make build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Runtime subpath the app is mounted at. '/' serves at root.
# Override at container start: `docker run -e BASE_PATH=/welcome-page/ ...`
# Applied once at boot by docker/30-substitute-base-path.sh.
ENV BASE_PATH=/

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/30-substitute-base-path.sh /docker-entrypoint.d/30-substitute-base-path.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

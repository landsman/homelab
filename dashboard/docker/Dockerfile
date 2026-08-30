# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:26-alpine AS builder

RUN apk add --no-cache make

WORKDIR /app

COPY package.json package-lock.json* Makefile ./
RUN make install

COPY . .
RUN make build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
# The unprivileged variant rather than nginx:alpine + a USER line: it already
# ships the writable pid path and cache dirs a non-root master needs, and it
# listens on 8080 because a non-root process cannot bind 80 everywhere.
FROM nginxinc/nginx-unprivileged:alpine AS runner

# The base image ships whatever Alpine packages it had at its last rebuild, so a
# fixed openssl sits in the repo for days before the tag catches up. Patch here
# instead of waiting; needs root because the base already drops to UID 101.
USER root
RUN apk upgrade --no-cache

# Runtime subpath the app is mounted at. '/' serves at root.
# Override at container start: `docker run -e BASE_PATH=/dashboard/ ...`
# Applied once at boot by docker/30-substitute-base-path.sh.
ENV BASE_PATH=/

# Owned by nginx because 30-substitute-base-path.sh rewrites index.html in place
# at boot, as the unprivileged user.
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/30-substitute-base-path.sh /docker-entrypoint.d/30-substitute-base-path.sh

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

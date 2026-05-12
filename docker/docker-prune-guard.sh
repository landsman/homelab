# docker-prune-guard.sh
#
# Purpose:
#   Protect critical containers (e.g. ephemeral GitHub Actions runners) from
#   being swept by ad-hoc `docker system prune` / `docker container prune`.
#
# Problem it solves:
#   Ephemeral runners exit between jobs and briefly enter "stopped" state.
#   A raw `docker system prune` removes ALL stopped containers — including
#   those briefly-stopped runners — and they are gone before the next job
#   starts. Same risk for any short-lived but important container.
#
# How it works:
#   This file defines a shell function named `docker` that shadows the real
#   `docker` binary in the current shell. When the user types
#     `docker system prune`     → it runs `docker system prune --filter "label!=preserve=true" ...`
#     `docker container prune`  → same filter applied
#     anything else             → passes through unchanged via `command docker`
#
#   Containers carrying the label `preserve=true` (set in their compose file
#   under `labels:`) are excluded from these prune commands. Image / network /
#   build-cache pruning is unaffected — only container removal is filtered.
#
# Scope / limitations:
#   - Interactive shells only. Cron, systemd, and non-interactive scripts do
#     NOT source ~/.bashrc, so they bypass this guard. For scheduled cleanup
#     use the `make prune` target in this directory, which carries the same
#     filter explicitly.
#   - Only `system prune` and `container prune` are wrapped. `image prune` is
#     intentionally untouched — pruning unused images is safe because images
#     in use by any container (running or stopped) are never removed.
#   - The function only matches the literal subcommand pair `system prune` /
#     `container prune`. Flags before them (none are valid for docker root)
#     would not be matched, but docker accepts none here, so this is fine.
#
# Install:
#   `make guard-install` from this directory appends a `source` line to
#   ~/.bashrc, then `source ~/.bashrc` activates it for the current shell.
#
# Verify:
#   `type docker` → should print the function body, not "/usr/bin/docker".
#   `docker system prune --help | head -1` → still works (passthrough).

docker() {
	if [ "$1" = "system" ] && [ "$2" = "prune" ]; then
		shift 2
		command docker system prune --filter "label!=preserve=true" "$@"
	elif [ "$1" = "container" ] && [ "$2" = "prune" ]; then
		shift 2
		command docker container prune --filter "label!=preserve=true" "$@"
	else
		command docker "$@"
	fi
}

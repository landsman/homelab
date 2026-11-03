#!/usr/bin/env bash
# Reads an output from the real state, asking for the R2 credentials instead of keeping them in a
# file: typed without echo, held by this process only, gone when it exits.
#
#   state.sh output <terraform output args>      e.g. state.sh output -raw tailscale_authkey
#
# A value already in the environment is used as it is (`op run`, CI) and not asked for. Without a
# terminal, or with CI set, a missing one stops the script naming it: a job waiting for an answer
# holds its runner until it times out.
set -euo pipefail
cd "$(dirname "$0")"

main() {
	case "${1:-}" in
	output)
		shift
		need POLLOS_CZ_CF_ACCOUNT_ID 'the Cloudflare account id'
		need POLLOS_CZ_R2_ACCESS_KEY_ID "the R2 token's access key id" secret
		need POLLOS_CZ_R2_SECRET_ACCESS_KEY "the R2 token's secret" secret
		# The backend reads these from the environment, as in pollos-deploy.yml. The endpoint is
		# inline because a backend block cannot read a variable, and the account id is no secret.
		export AWS_ACCESS_KEY_ID=$POLLOS_CZ_R2_ACCESS_KEY_ID
		export AWS_SECRET_ACCESS_KEY=$POLLOS_CZ_R2_SECRET_ACCESS_KEY
		# -reconfigure because `make validate` inits with -backend=false, and Terraform refuses to
		# switch back without it.
		terraform init -reconfigure -input=false \
			-backend-config="endpoints={s3=\"https://$POLLOS_CZ_CF_ACCOUNT_ID.r2.cloudflarestorage.com\"}" >&2
		terraform output "$@"
		;;
	*)
		echo "usage: $0 output <terraform output args>" >&2
		exit 2
		;;
	esac
}

# Where answers are read from: the terminal, not stdin, which make often hands over as something
# else and which a pipe after the target does not reach. ASK_TTY replaces it in the test.
tty=${ASK_TTY:-/dev/tty}
opened=

# need <NAME> <what it is> [secret]: keeps $NAME when it is set, asks for it when it is not.
need() {
	[ -z "${!1:-}" ] || return 0
	if [ -n "${CI:-}" ] || ! { : <"$tty"; } 2>/dev/null; then
		echo "empty: $1, $2 (no terminal to ask at; pass it in the environment)" >&2
		exit 1
	fi
	# Opened once: a second `read <file` would open it again and read its first line again.
	[ -n "$opened" ] || { exec 3<"$tty" && opened=yes; }
	printf '%s, %s: ' "$1" "$2" >&2
	if [ -n "${3:-}" ]; then
		# Ctrl-C while typing would otherwise leave the terminal with echo off.
		trap 'stty echo <&3 2>/dev/null; exit 130' INT TERM
		stty -echo <&3 2>/dev/null || true
	fi
	local value=''
	IFS= read -r value <&3 || true
	if [ -n "${3:-}" ]; then
		stty echo <&3 2>/dev/null || true
		trap - INT TERM
		printf '\n' >&2
	fi
	[ -n "$value" ] || {
		echo "nothing typed for $1" >&2
		exit 1
	}
	export "$1=$value"
}

main "$@"

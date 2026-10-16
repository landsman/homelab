#!/usr/bin/env bash
# Tests 007-registry-mirror.sh without root or Docker: `docker` is a stub on PATH that answers
# `docker info` with $STORE, and /etc/docker/certs.d is a throwaway directory.
#
# What is worth testing is what goes wrong silently on a real box: a hosts.toml Docker cannot parse
# or that names the wrong server or port, a box on the classic image store that would ignore the
# files, and `off` that leaves a cache in place or deletes a certificate next to it.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/007-registry-mirror.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
mkdir -p "$t/bin"
export PATH="$t/bin:$PATH" CERTS_D="$t/certs.d" STORE=io.containerd.snapshotter.v1
cat >"$t/bin/docker" <<'STUB'
#!/bin/sh
echo "$STORE"
STUB
chmod +x "$t/bin/docker"

fail=0
check() { # check <behaviour> <command…>
	local what=$1
	shift
	if "$@"; then echo "ok   $what"; else echo "FAIL $what"; fail=1; fi
}
run() { # run <NAS or -> ; `-` leaves NAS unset. The script's exit code lands in $rc.
	rc=0
	if [ "$1" = - ]; then
		env -u NAS sh "$script" >/dev/null 2>&1 || rc=$?
	else
		NAS=$1 sh "$script" >/dev/null 2>&1 || rc=$?
	fi
}
# What Docker would read: the file parsed as TOML, so a quoting slip fails here as it would there.
hosts() { python3 -c '
import sys, tomllib
c = tomllib.load(open(sys.argv[1], "rb"))
print(c["server"], *[h + " " + str(sorted(v["capabilities"])) for h, v in c["host"].items()])
' "$CERTS_D/$1/hosts.toml" 2>/dev/null; }

nas=nas.example.ts.net
# Our own registries: Forgejo's, on the NAS's own name and behind git.insuit.cz. Docker reads a
# hosts.toml per registry, so a file under either name would send their pushes to a cache.
own_registries=("$nas" git.insuit.cz)
for r in "${own_registries[@]}"; do mkdir -p "$CERTS_D/$r" && printf 'cert\n' >"$CERTS_D/$r/ca.crt"; done
written() { (cd "$CERTS_D" && find . -name hosts.toml | sort | tr '\n' ' '); }

run "$nas"
check "it succeeds on the containerd image store" test "$rc" = 0
check "it writes a hosts.toml for the four mirrored registries and no other" \
	test "$(written)" = "./code.forgejo.org/hosts.toml ./docker.gitea.com/hosts.toml ./docker.io/hosts.toml ./ghcr.io/hosts.toml "
check "our own registries are left alone" test "$(cat "$CERTS_D/$nas/ca.crt" "$CERTS_D/git.insuit.cz/ca.crt")" = "$(printf 'cert\ncert')"
check "Docker Hub goes through its cache under /mirror" test "$(hosts docker.io)" = "https://registry-1.docker.io https://$nas/mirror/docker.io ['pull', 'resolve']"
check "ghcr.io through its own" test "$(hosts ghcr.io)" = "https://ghcr.io https://$nas/mirror/ghcr.io ['pull', 'resolve']"
check "docker.gitea.com through its own" test "$(hosts docker.gitea.com)" = "https://docker.gitea.com https://$nas/mirror/docker.gitea.com ['pull', 'resolve']"
check "code.forgejo.org through its own" test "$(hosts code.forgejo.org)" = "https://code.forgejo.org https://$nas/mirror/code.forgejo.org ['pull', 'resolve']"

before=$(cat "$CERTS_D"/*/hosts.toml)
run "$nas"
check "a re-run writes the same files" test "$(cat "$CERTS_D"/*/hosts.toml)" = "$before"

printf 'cert\n' >"$CERTS_D/ghcr.io/ca.crt"
run off
check "off removes every hosts.toml" test -z "$(find "$CERTS_D" -name hosts.toml)"
check "and keeps a certificate next to one" test -f "$CERTS_D/ghcr.io/ca.crt"
check "and the directories it emptied" test ! -e "$CERTS_D/docker.io"
check "and leaves our own registries' directories" test -f "$CERTS_D/$nas/ca.crt" -a -f "$CERTS_D/git.insuit.cz/ca.crt"

rm -rf "$CERTS_D"
STORE=overlay2 run "$nas"
check "the classic image store is refused" test "$rc" != 0
check "and nothing is written there" test ! -e "$CERTS_D"

run "https://$nas"
check "a URL instead of a host name is refused" test "$rc" != 0
run -
check "NAS unset is refused" test "$rc" != 0

exit "$fail"

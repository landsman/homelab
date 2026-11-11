#!/bin/sh
# No set -e: every check runs and reports, and the exit code comes at the end.
set -u

# The one decision in host/ that fails silently: editing cmdline.txt, where a
# wrong edit is a Pi that does not boot and a false "changed" a pointless
# reboot. Runs the real function on copies, needs no root (and GNU sed).

s="$(cd "$(dirname "$0")" && pwd)/docker-host.sh"
t="$(mktemp -d)"
trap 'chmod -R u+w "$t"; rm -rf "$t"' EXIT
fail=0
# usage: check "behaviour" <command...>
check() { d="$1"; shift; if "$@"; then echo "ok   $d"; else echo "FAIL $d"; fail=1; fi; }

f="$t/cmdline.txt"
printf 'console=serial0,115200 root=PARTUUID=abc rootwait\n' > "$f"
check "a first run says it changed the file" [ "$(sh "$s" cmdline "$f")" = changed ]
check "a second run changes nothing" [ "$(sh "$s" cmdline "$f")" = "" ]
check "the file stays one line" [ "$(wc -l < "$f")" -eq 1 ]
check "the flag is appended exactly once, the rest untouched" \
  grep -qx 'console=serial0,115200 root=PARTUUID=abc rootwait cgroup_enable=memory' "$f"

printf 'one\ntwo\n' > "$t/two.txt"
sh "$s" cmdline "$t/two.txt" >/dev/null 2>&1 && two=0 || two=1
check "a two-line file is refused" [ "$two" = 1 ]
sh "$s" cmdline "$t/missing.txt" >/dev/null 2>&1 && missing=0 || missing=1
check "a missing file is refused" [ "$missing" = 1 ]

# sed -i writes a temp file beside it, so a read-only directory makes it fail,
# as a read-only /boot/firmware would
mkdir "$t/ro"
printf 'rootwait\n' > "$t/ro/cmdline.txt"
chmod a-w "$t/ro"
out="$(sh "$s" cmdline "$t/ro/cmdline.txt" 2>/dev/null)" && rc=0 || rc=1
check "a write that fails is an error, not \"changed\"" [ "$rc$out" = 1 ]

exit $fail

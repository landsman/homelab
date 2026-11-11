#!/bin/sh
set -eu

# The one decision in host/ that fails silently: editing cmdline.txt, where a
# wrong edit is a Pi that does not boot and a false "changed" a pointless
# reboot. Runs the real function on copies, needs no root (and GNU sed).

s="$(cd "$(dirname "$0")" && pwd)/docker-host.sh"
t="$(mktemp -d)"
trap 'chmod -R u+w "$t"; rm -rf "$t"' EXIT
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

f="$t/cmdline.txt"
printf 'console=serial0,115200 root=PARTUUID=abc rootwait\n' > "$f"
check "a first run says it changed the file" '[ "$(sh "$s" cmdline "$f")" = changed ]'
check "a second run changes nothing" '[ "$(sh "$s" cmdline "$f")" = "" ]'
check "the file stays one line" '[ "$(wc -l < "$f")" -eq 1 ]'
check "the flag is appended exactly once, the rest untouched" \
  'grep -qx "console=serial0,115200 root=PARTUUID=abc rootwait cgroup_enable=memory" "$f"'

printf 'one\ntwo\n' > "$t/two.txt"
check "a two-line file is refused" '! sh "$s" cmdline "$t/two.txt" >/dev/null 2>&1'
check "a missing file is refused" '! sh "$s" cmdline "$t/missing.txt" >/dev/null 2>&1'

# sed -i writes a temp file beside it, so a read-only directory makes it fail,
# as a read-only /boot/firmware would
mkdir "$t/ro"
printf 'rootwait\n' > "$t/ro/cmdline.txt"
chmod a-w "$t/ro"
out="$(sh "$s" cmdline "$t/ro/cmdline.txt" 2>/dev/null)" && rc=0 || rc=$?
check "a write that fails is an error, not \"changed\"" '[ "$rc" -ne 0 ] && [ "$out" != changed ]'

exit $fail

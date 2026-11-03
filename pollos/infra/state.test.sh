#!/usr/bin/env bash
# state.sh with terraform and stty stubbed. What it would get wrong silently: an answer that never
# reaches terraform, every answer read as the first line, a value from the environment asked again,
# a prompt or a terraform line mixed into the output that is piped into pbcopy, and asking in CI.
set -u
script="$(cd "$(dirname "$0")" && pwd)/state.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
mkdir "$t/bin"
cat >"$t/bin/terraform" <<'EOF'
#!/bin/sh
echo "terraform $* key=$AWS_ACCESS_KEY_ID secret=$AWS_SECRET_ACCESS_KEY" >>"$LOG"
[ "$1" = output ] && printf 'the-value'
echo "init noise" >&2
EOF
printf '#!/bin/sh\n' >"$t/bin/stty"
chmod +x "$t/bin/terraform" "$t/bin/stty"
export PATH="$t/bin:$PATH" LOG="$t/log"
unset CI POLLOS_CZ_CF_ACCOUNT_ID POLLOS_CZ_R2_ACCESS_KEY_ID POLLOS_CZ_R2_SECRET_ACCESS_KEY
rc=0
# check <behaviour> <exit status of the condition, run just before>
check() { if [ "$2" -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1"; rc=1; fi; }

printf 'acct\nkeyid\nsecret\n' >"$t/answers"
: >"$LOG"
out=$(ASK_TTY="$t/answers" "$script" output -raw tailscale_authkey 2>"$t/err")
grep -q 'key=keyid secret=secret' "$LOG"; check 'each answer goes to its own variable' $?
grep -q 'https://acct.r2.cloudflarestorage.com' "$LOG"; check 'the account id builds the endpoint' $?
grep -q 'terraform output -raw tailscale_authkey' "$LOG"; check 'the output args reach terraform output' $?
is() { [ "$1" = "$2" ]; }
is "$out" the-value; check 'stdout holds the value and nothing else' $?
grep -q POLLOS_CZ_R2_SECRET_ACCESS_KEY "$t/err"; check 'the prompts go to stderr' $?

: >"$t/empty"
: >"$LOG"
out=$(POLLOS_CZ_CF_ACCOUNT_ID=a POLLOS_CZ_R2_ACCESS_KEY_ID=k POLLOS_CZ_R2_SECRET_ACCESS_KEY=s \
	ASK_TTY="$t/empty" "$script" output -raw x 2>"$t/err")
! grep -q ': ' "$t/err" && is "$out" the-value; check 'values in the environment are not asked for' $?

: >"$LOG"
! CI=true ASK_TTY="$t/answers" "$script" output -raw x 2>"$t/err" >/dev/null &&
	grep -q 'empty: POLLOS_CZ_CF_ACCOUNT_ID' "$t/err" && ! test -s "$LOG"
check 'CI stops instead of asking' $?

printf 'acct\n\n' >"$t/short"
! ASK_TTY="$t/short" "$script" output -raw x 2>"$t/err" >/dev/null &&
	grep -q 'nothing typed for POLLOS_CZ_R2_ACCESS_KEY_ID' "$t/err" && ! test -s "$LOG"
check 'an empty answer stops before terraform' $?

exit $rc

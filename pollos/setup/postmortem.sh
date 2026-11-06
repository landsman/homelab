#!/bin/sh
set -eu

#
# Why did this box go down? Leaves evidence behind before a crash, and reads it
# after the restart. Run as root.
#
#   wget -O postmortem.sh https://pollos.cz/postmortem.sh
#   sudo sh postmortem.sh install   # once per box; safe to re-run; not from a pipe
#   sudo postmortem                 # after an unexpected restart: evidence + verdict
#
# What install changes, so the next crash says what it was:
#
#   - a kernel panic, oops or CPU lockup reboots after 10 s instead of freezing
#     forever; the kernel's dump survives in EFI pstore and systemd-pstore
#     archives it to /var/lib/systemd/pstore on the next boot
#   - systemd feeds the hardware watchdog (Intel iTCO), so a hang the kernel
#     cannot even panic on is reset by the chipset instead of waiting for the
#     button. It leaves no mark: iTCO_wdt clears the chip's timeout bit at
#     probe and reports bootstatus 0 after every boot
#   - a heartbeat every minute, fsynced, with the hottest sensor and the load:
#     the last line before a crash is the time of death to the minute, and says
#     whether it was hot or busy
#   - journald flushes every 30 s instead of 5 min, so a hang loses less log
#   - smartmontools, for the drive's own count of unsafe shutdowns; it reads
#     saul's NVMe and the other boxes' SATA SSDs alike
#
# What none of it can tell apart: a power cut vs a hang that did not panic.
# Both end with no shutdown and no dump. A hang the watchdog reset comes back
# on its own; one with the button needed, the power LED says — on and frozen is
# a hang, off is power.
#
# Subcommands the tests call (no root, no box):
#
#   sh postmortem.sh ended-clean < journal-tail   # exit 0 if it shut down cleanly
#   sh postmortem.sh verdict CLEAN PANICS
#

BIN=/usr/local/sbin/postmortem
STATE=/var/lib/postmortem
HEARTBEAT="$STATE/heartbeat.log"
PSTORE=/var/lib/systemd/pstore
WATCHDOG=/sys/class/watchdog/watchdog0

# A clean poweroff or reboot ends with systemd-shutdown taking journald down.
ended_clean() {
    grep -qE 'systemd-shutdown\[1\]|systemd-journald\[[0-9]+\]: Journal stopped'
}

# CLEAN: 1 if the previous boot ended clean; PANICS: kernel dumps saved since
# this boot. A shutdown that panicked on its way down still logs as clean, so
# the dump is checked first.
verdict() {
    if [ "$2" -gt 0 ]; then
        echo "kernel panic: the dump is in $PSTORE"
    elif [ "$1" = 1 ]; then
        echo "clean shutdown: something asked for it — a person, an upgrade, the power button"
    else
        echo "power lost, or a hang the watchdog reset: no shutdown, no panic — if it came back on its own it was the watchdog; if it needed the button, a lit power LED means a hang and a dark one the socket, the power brick or the BIOS power log"
    fi
}

heartbeat() {
    mkdir -p "$STATE"
    # millidegrees from every sensor the kernel exposes; the hottest is the one that matters
    temp=$(cat /sys/class/thermal/thermal_zone*/temp /sys/class/hwmon/hwmon*/temp*_input 2>/dev/null |
        sort -n | tail -1)
    printf '%s boot=%.8s temp=%sC load=%s\n' \
        "$(date -Is)" "$(cat /proc/sys/kernel/random/boot_id)" "$((${temp:-0} / 1000))" \
        "$(cut -d' ' -f1-3 /proc/loadavg | tr ' ' /)" >> "$HEARTBEAT"
    # ponytail: ~2 weeks of minutes, trimmed in place; logrotate if it ever needs more
    if [ "$(wc -l < "$HEARTBEAT")" -gt 21000 ]; then
        tail -20000 "$HEARTBEAT" > "$HEARTBEAT.tmp" && mv "$HEARTBEAT.tmp" "$HEARTBEAT"
    fi
    sync "$HEARTBEAT"
}

report() {
    booted=$(date -d "$(uptime -s)" +%s)
    boot=$(cut -c1-8 /proc/sys/kernel/random/boot_id)

    echo "== boots"
    journalctl --list-boots --no-pager | tail -3
    echo
    echo "== last lines of the previous boot"
    journalctl -b -1 -n 15 --no-pager -o short-iso
    clean=0
    journalctl -b -1 -n 50 --no-pager | ended_clean && clean=1
    echo
    echo "== last heartbeats before this boot (time of death, temperature, load)"
    if [ -f "$HEARTBEAT" ]; then grep -v "boot=$boot" "$HEARTBEAT" | tail -5; else echo "none — install had not run yet"; fi
    echo
    echo "== kernel dumps saved since this boot"
    panics=0
    if [ -d "$PSTORE" ]; then
        panics=$(find "$PSTORE" -mindepth 1 -maxdepth 1 -newermt "@$booted" | wc -l)
        find "$PSTORE" -mindepth 1 -maxdepth 1 -newermt "@$booted"
    fi
    echo "$panics found"
    echo
    echo "== hardware watchdog (armed or not; it cannot say whether it fired)"
    if [ -r "$WATCHDOG/state" ]; then
        echo "$(cat "$WATCHDOG/identity") state=$(cat "$WATCHDOG/state")"
    else
        echo "none"
    fi
    echo
    echo "== drive (unsafe shutdowns count every power loss and hard reset, ever)"
    if command -v smartctl >/dev/null; then
        disk=/dev/$(lsblk -no PKNAME "$(findmnt -no SOURCE /)")
        echo "$disk"
        # NVMe says "Unsafe Shutdowns", the SATA A400 "Unsafe_Shutdown_Count"
        smartctl -A "$disk" | grep -iE 'unsafe|power.cycle|temperature' || true
    else
        echo "smartmontools missing"
    fi
    echo
    echo "== verdict"
    verdict "$clean" "$panics"
}

install_() {
    # it installs a copy of itself, which a pipe has none of
    [ -f "$0" ] || { echo "download it first: wget -O postmortem.sh https://pollos.cz/postmortem.sh && sudo sh postmortem.sh install" >&2; exit 1; }
    [ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq smartmontools >/dev/null
    cmp -s "$0" "$BIN" || install -m 0755 "$0" "$BIN"

    cat > /etc/sysctl.d/90-postmortem.conf <<'EOF'
# reboot 10 s after a panic instead of freezing; the dump stays in EFI pstore
kernel.panic = 10
kernel.panic_on_oops = 1
kernel.hardlockup_panic = 1
# a soft lockup that recovers has already logged its trace; rebooting a node and
# rescheduling its jobs for every 20 s stall buys nothing, and one that never
# recovers turns into a hard lockup, which panics above. 0, not absent, so a
# re-run turns off what the first version of this script turned on
kernel.softlockup_panic = 0
EOF
    # this file only: --system reloads every file, and one key this kernel lacks
    # would stop the install with the panic settings on and the rest not set up
    sysctl -q -p /etc/sysctl.d/90-postmortem.conf

    mkdir -p /etc/systemd/system.conf.d /etc/systemd/journald.conf.d
    cat > /etc/systemd/system.conf.d/watchdog.conf <<'EOF'
# systemd pets the hardware watchdog; a hung kernel stops petting and the chipset resets the box
[Manager]
RuntimeWatchdogSec=60s
RebootWatchdogSec=10min
EOF
    cat > /etc/systemd/journald.conf.d/sync.conf <<'EOF'
[Journal]
SyncIntervalSec=30s
EOF

    cat > /etc/systemd/system/postmortem-heartbeat.service <<EOF
[Unit]
Description=Write the postmortem heartbeat

[Service]
Type=oneshot
ExecStart=$BIN heartbeat
EOF
    cat > /etc/systemd/system/postmortem-heartbeat.timer <<'EOF'
[Unit]
Description=Postmortem heartbeat every minute

[Timer]
OnCalendar=minutely
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reexec
    systemctl restart systemd-journald
    systemctl enable --now postmortem-heartbeat.timer
    echo "installed. watchdog: $(cat "$WATCHDOG/state" 2>/dev/null || echo none), panic=$(cat /proc/sys/kernel/panic)"
}

case "${1:-report}" in
    install) install_ ;;
    heartbeat) heartbeat ;;
    report) report ;;
    ended-clean) ended_clean ;;
    verdict) verdict "$2" "$3" ;;
    *) sed -n '/^# Why did/,/^#   sudo postmortem /p' "$0"; exit 1 ;;
esac

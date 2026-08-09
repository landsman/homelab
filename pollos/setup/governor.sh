#!/bin/sh
set -eu

#
# CPU frequency governor for this box. Run as root.
#
#   ./governor.sh            # apply the GOVERNOR set below
#   ./governor.sh powersave  # one-off override, lasts until reboot
#   ./governor.sh status     # driver, current governor, what's available
#   ./governor.sh install    # copy to /usr/local/sbin + re-apply on every boot
#
# After install it is on sudo's PATH, so from anywhere on the box:
#   sudo governor status
#   sudo governor powersave
#
# The persistent value is the GOVERNOR line right below. To change it for good:
# edit the installed copy at /usr/local/sbin/governor and run it.
#

GOVERNOR=performance
BIN=/usr/local/sbin/governor

CPUFREQ=/sys/devices/system/cpu/cpu0/cpufreq
[ -d "${CPUFREQ}" ] || { echo "no cpufreq here — driver missing or disabled in BIOS" >&2; exit 1; }

case "${1:-}" in
  status)
    printf "driver    : %s\n" "$(cat "${CPUFREQ}/scaling_driver")"
    printf "current   : %s\n" "$(cat "${CPUFREQ}/scaling_governor")"
    printf "available : %s\n" "$(cat "${CPUFREQ}/scaling_available_governors")"
    exit 0
    ;;
  install)
    # cmp guard: running `install` from the installed copy itself is a no-op
    cmp -s "$0" "${BIN}" || install -m 0755 "$0" "${BIN}"
    cat > /etc/systemd/system/cpu-governor.service <<EOF
[Unit]
Description=Set CPU frequency governor

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${BIN}

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now cpu-governor.service
    echo "installed. governor now: $(cat "${CPUFREQ}/scaling_governor")"
    exit 0
    ;;
  "") ;;
  *) GOVERNOR=$1 ;;
esac

AVAILABLE=$(cat "${CPUFREQ}/scaling_available_governors")
case " ${AVAILABLE} " in
  *" ${GOVERNOR} "*) ;;
  *) echo "unknown governor '${GOVERNOR}' — available: ${AVAILABLE}" >&2; exit 1 ;;
esac

for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
  echo "${GOVERNOR}" > "${g}"
done

echo "governor now: $(cat "${CPUFREQ}/scaling_governor")"

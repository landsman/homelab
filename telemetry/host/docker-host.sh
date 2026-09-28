#!/bin/sh
set -eu

#
# PURPOSE: prepare the Pi that runs the telemetry stack under rootless Docker.
# Run once, as root, then reboot:
#
#   sudo sh telemetry/host/docker-host.sh
#
# 1. Memory accounting. The Raspberry Pi kernel ships with cgroup_disable=memory;
#    a later cgroup_enable=memory on the command line overrides it
#    (raspberrypi/linux#6980). Without it no container reports memory.
# 2. Delegation. Rootless containers live under user@<uid>.service, which by
#    default gets only cpu and pids. The drop-in is the one Docker documents:
#    https://docs.docker.com/engine/security/rootless/tips/
# 3. The journal, readable by the Docker user. An ACL, not a group: runc drops
#    supplementary groups, so systemd-journal would never reach the container.
#
# Safe to re-run. DOCKER_USER defaults to containers (docker/README.md).
#

CMDLINE=/boot/firmware/cmdline.txt
DOCKER_USER="${DOCKER_USER:-containers}"

# Appends cgroup_enable=memory to the single line of FILE unless it is there.
# Prints "changed" when it wrote. Its own subcommand so a test can run it on a
# copy: a broken cmdline.txt is a Pi that does not boot.
cmdline() {
  file="$1"
  [ "$(wc -l < "$file")" -le 1 ] || { echo "$file has more than one line, not touching it"; exit 1; }
  if ! grep -qw 'cgroup_enable=memory' "$file"; then
    sed -i '1 s/[[:space:]]*$/ cgroup_enable=memory/' "$file"
    echo changed
  fi
}

install() {
  [ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
  id "$DOCKER_USER" >/dev/null

  reboot=
  if [ "$(cmdline "$CMDLINE")" = changed ]; then
    reboot=1
  fi

  mkdir -p /etc/systemd/system/user@.service.d
  printf '[Service]\nDelegate=cpu cpuset io memory pids\n' > /etc/systemd/system/user@.service.d/delegate.conf
  systemctl daemon-reload

  # default ACLs on the directories, so files journald creates later inherit it
  cat > /etc/tmpfiles.d/journal-"$DOCKER_USER".conf <<EOF
a+ /var/log/journal - - - - d:user:$DOCKER_USER:r-x,user:$DOCKER_USER:r-x
a+ /var/log/journal/%m - - - - d:user:$DOCKER_USER:r-x,user:$DOCKER_USER:r-x
a+ /var/log/journal/%m/*.journal* - - - - user:$DOCKER_USER:r--
EOF
  systemd-tmpfiles --create /etc/tmpfiles.d/journal-"$DOCKER_USER".conf

  if [ -n "$reboot" ]; then
    echo "done — reboot for memory accounting: sudo reboot"
  else
    echo "done — already set up; nothing needs a reboot"
  fi
}

case "${1:-install}" in
  install) install ;;
  cmdline) cmdline "${2:?usage: $0 cmdline FILE}" ;;
  *) echo "usage: $0 [install|cmdline FILE]"; exit 1 ;;
esac

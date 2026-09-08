# Pi 5 — Rootless Docker Setup

Running Docker as root is a security risk: a container escape gives full system access.
This guide migrates all Docker and Compose workloads to a non-root user.

---

## Why rootless Docker?

| Issue with root Docker                         | Rootless Docker                             |
|------------------------------------------------|---------------------------------------------|
| Container escape = full root access            | Escape lands in unprivileged user namespace |
| Any process can talk to `/var/run/docker.sock` | Socket only accessible to your user         |
| Containers run as root inside by default       | UIDs are remapped to unprivileged ranges    |

---

## Dedicated Docker user

Instead of running rootless Docker as your primary user, create a dedicated user.
If a container escapes, it lands in an isolated account with no access to your personal files.
You manage containers by SSH-ing in as this user — no `sudo` ever needed.

```bash
# Create the user (no login shell needed for day-to-day, but bash makes SSH sessions usable)
sudo useradd -m -s /bin/bash containers

# Set a password so SSH login works
sudo passwd containers

# Enable lingering so the daemon starts at boot without an active session
sudo loginctl enable-linger containers

# This gives Docker a "fallback" for permanent storage that is persistent
sudo apt-get install -y fuse-overlayfs
```

Add your SSH public key so you can log in without a password:

```bash
sudo mkdir -p /home/containers/.ssh
sudo cp ~/.ssh/authorized_keys /home/containers/.ssh/
sudo chown -R containers:containers /home/containers/.ssh
sudo chmod 700 /home/containers/.ssh
sudo chmod 600 /home/containers/.ssh/authorized_keys
```

From now on, manage Docker by SSH-ing in as this user:

```bash
ssh containers@<pi-ip>
```

All steps below should be run as the `containers` user, not your primary user.

---

## Prerequisites

```bash
# Install required packages
sudo apt update
sudo apt install -y uidmap slirp4netns fuse-overlayfs dbus-user-session
```

| Package             | Why it's needed                                                                                                            |
|---------------------|----------------------------------------------------------------------------------------------------------------------------|
| `uidmap`            | Provides `newuidmap`/`newgidmap` — the binaries that remap container UIDs to an unprivileged range (`100000+`) on the host |
| `slirp4netns`       | User-space network stack so containers get internet access without kernel bridge privileges                                |
| `fuse-overlayfs`    | Fallback copy-on-write driver, only needed on kernels below 5.11 — see [Storage driver](#9-storage-driver)                  |
| `dbus-user-session` | Enables the per-user D-Bus session that `systemctl --user` and lingering depend on                                         |

> These are not installed by default on Raspberry Pi OS Lite. Running the command is safe regardless — apt skips anything already present.

```bash
# Verify your user has a subuid/subgid range allocated
grep ^containers /etc/subuid   # should show something like: containers:100000:65536
grep ^containers /etc/subgid

# If missing, add them manually
sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 containers
```

---

## 1. Stop and disable the root Docker daemon

```bash
sudo systemctl disable --now docker.socket docker.service containerd.service
```

> Keep the Docker package installed — the binaries are still needed for rootless mode.

---

## 2. Install rootless Docker for your user

Run this as the **containers** user (not root):

```bash
dockerd-rootless-setuptool.sh install
```

This sets up `~/.config/docker/` and a systemd user unit at
`~/.config/systemd/user/docker.service`.

---

## 3. Enable and start the user Docker daemon

```bash
systemctl --user start docker
systemctl --user enable docker
```

Verify the daemon is running:

```bash
systemctl --user status docker
```

---

## 4. Configure environment variables

```bash
echo 'export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock' | tee -a ~/.bashrc ~/.profile
echo 'export PATH=$HOME/bin:$PATH' | tee -a ~/.bashrc ~/.profile
source ~/.bashrc
```

Test it:

```bash
docker info   # should show rootless: true under Server
```

---

## 5. Port binding below 1024

Rootless containers cannot bind to privileged ports (< 1024) by default.

**Option A — use high ports** (recommended): expose `8080` instead of `80`, `8443` instead of `443`.

**Option B — allow via sysctl**:

```bash
# Allow all unprivileged users to bind down to port 80
echo "net.ipv4.ip_unprivileged_port_start=80" | sudo tee /etc/sysctl.d/99-rootless-ports.conf
sudo sysctl --system
```

---

## 7. Volume permissions

Rootless Docker remaps UIDs. Files written by a container appear owned by a high UID on the host
(`100000+` range). Fix ownership for bind-mounted directories:

```bash
# Find what UID the container writes as on the host
ls -ln /path/to/volume

# Allow your user to own the directory
sudo chown -R containers:containers /path/to/volume
```


---

## 8. Move Docker storage to NVMe

By default rootless Docker stores images, containers, and volumes under `~/.local/share/docker`.
On a Pi 5 with an NVMe RAID mounted at `/mnt/raid0` (see [nas/README.md](../nas/README.md)), point Docker to a dedicated directory there to avoid filling the SD card.

The RAID is mounted globally via `/etc/fstab` — all users can reach `/mnt/raid0`. Just create the directory and set ownership (run as your primary user):

```bash
sudo mkdir -p /mnt/raid0/containers/docker
sudo chown -R containers:containers /mnt/raid0/containers
```

Then as the `containers` user, point the daemon at it:

```bash
mkdir -p ~/.config/docker
echo '{"data-root": "/mnt/raid0/containers/docker"}' > ~/.config/docker/daemon.json
systemctl --user restart docker
docker info | grep "Docker Root Dir"   # should show /mnt/raid0/containers/docker
```

Add symlinks for quick access:

```bash
ln -s /mnt/raid0/containers/docker ~/docker
ln -s /mnt/raid0/containers ~/dev
```

### Make Docker wait for the RAID mount

If the RAID isn't mounted when Docker starts at boot, Docker silently falls back to `~/.local/share/docker` and creates empty volumes. Prevent this with a systemd drop-in:

```bash
mkdir -p ~/.config/systemd/user/docker.service.d
printf '[Unit]\nRequiresMountsFor=/mnt/raid0\n' > ~/.config/systemd/user/docker.service.d/wait-for-raid.conf
systemctl --user daemon-reload
```

Docker will now refuse to start if `/mnt/raid0` is not mounted.

---

## 9. Storage driver

Rootless Docker has two ways to store image layers: the kernel's `overlay2`, or `fuse-overlayfs`
in userspace. Prefer `overlay2`. `fuse-overlayfs` is a FUSE mount held by a userspace process,
and when one of those wedges the daemon cannot unmount the container's rootfs — the container is
left in `Dead` state, `docker compose up` answers `container is marked for removal and cannot be
started`, and only `docker rm -f` clears it. Containers that are recreated often are the ones
that hit it.

Check what is in use before changing anything — on kernel 5.11+ Docker usually picks `overlay2`
on its own, in which case there is nothing to do:

```bash
docker info --format '{{.Driver}}'   # overlay2 = done, fuse-overlayfs = read on
uname -r                             # needs 5.11 or newer to switch
```

### Switching from fuse-overlayfs to overlay2

**This discards every image and container on the host.** Each driver keeps its own layer store, so
after the switch Docker sees no images and every container has to be recreated. **Named volumes
survive** — they live in `<data-root>/volumes/` and belong to no driver — so application data is
not at risk, but plan for a maintenance window and expect to re-pull everything.

```bash
# 1. Stop everything cleanly, so nothing is mid-write
systemctl --user stop docker

# 2. Add the driver next to the existing data-root
#    (the file already holds data-root from section 8 — edit it, do not overwrite it)
cat ~/.config/docker/daemon.json
```

```json
{
  "data-root": "/mnt/raid0/containers/docker",
  "storage-driver": "overlay2"
}
```

```bash
# 3. Start the daemon and confirm
systemctl --user start docker
docker info --format '{{.Driver}}'      # overlay2

# 4. Bring the apps back up — images re-pull on demand
for d in ~/dev/apps/*/; do (cd "$d" && [ -f compose.yml ] && docker compose up -d); done
```

The old `fuse-overlayfs` layer directory is left behind under
`/mnt/raid0/containers/docker/fuse-overlayfs`. Once everything is confirmed running, it can go:

```bash
du -sh /mnt/raid0/containers/docker/fuse-overlayfs
rm -rf /mnt/raid0/containers/docker/fuse-overlayfs
```

To roll back, remove the `storage-driver` key and restart the daemon — the old layers are still
there until the directory above is deleted.

---

## Maintenance

Create cleanup cron. It will remove old containers and images at 3:30 AM every day:

```bash
make install-cron
```


## Troubleshooting

### Volumes missing after reboot (old data in `~/.local/share/docker`)

Changing `data-root` does **not** move existing volumes — they stay in `~/.local/share/docker/volumes/`. If containers start fresh after switching to NVMe storage, copy volumes manually:

```bash
# For each volume, stop its containers first, then:
docker run --rm \
  -v ~/.local/share/docker/volumes/<volume_name>/_data:/olddata \
  -v /mnt/raid0/containers/docker/volumes/<volume_name>/_data:/newdata \
  alpine sh -c "cp -a /olddata/. /newdata/"
```

For compose projects, declare the volume as `external` so Compose reuses the existing volume instead of creating a new empty one:

```yaml
volumes:
  my-volume:
    external: true
    name: <actual_volume_name>   # e.g. projectname_volumekey
```

Once all volumes are migrated and confirmed working, remove the old storage:

```bash
rm -rf ~/.local/share/docker
```

---

### Container stuck in `Dead`, `docker compose up` says "marked for removal"

The daemon failed to unmount the container's rootfs and parked it. Restarting the daemon does not
clear it, because the metadata stays on disk — `up` keeps refusing with
`container is marked for removal and cannot be started`.

```bash
docker ps -a --filter status=dead        # find them
docker rm -f <id> <id>                   # usually enough after a daemon restart
```

If `rm -f` fails with `device or resource busy`, remove the metadata with the daemon down:

```bash
systemctl --user stop docker
ls "$(docker info --format '{{.DockerRootDir}}')/containers/"   # confirm the IDs first
rm -rf /mnt/raid0/containers/docker/containers/<id>
systemctl --user start docker
```

Leftover layer directories are swept by the next `docker system prune`. If this keeps happening,
the driver is the cause — see [Storage driver](#9-storage-driver).

### `dial unix /run/user/1000/docker.sock: no such file or directory`

The rootless Docker daemon is not running for your session.

```bash
# Start it
systemctl --user start docker

# Check why it failed to start automatically
systemctl --user status docker
journalctl --user -u docker -n 50
```

If the daemon never starts at boot, verify lingering is enabled:

```bash
loginctl show-user containers | grep Linger   # should be Linger=yes
```

If not:
```bash
sudo loginctl enable-linger containers
```

### `DOCKER_HOST` not set after SSH login

Re-run the commands from step 4:

```bash
echo 'export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock' | tee -a ~/.bashrc ~/.profile
source ~/.bashrc
```

### Permission denied on `/var/run/docker.sock`

You're accidentally hitting the old root socket. Confirm `DOCKER_HOST` is set:

```bash
echo $DOCKER_HOST
```

### Checking which Docker is in use

```bash
docker context ls
docker info | grep -i rootless
```

---

## lazydocker

Terminal UI for managing Docker containers. Installed as a native arm64 binary (no Docker required).

```bash
cd docker
make lazydocker   # installs v0.24.4 to ~/bin/ on first run
```

Run it anytime:

```bash
lazydocker
```

---

## Quick reference

```bash
# Daemon
systemctl --user start|stop|restart|status docker

# Run containers as usual
docker compose up -d
docker ps
docker compose logs -f

# View user daemon logs
journalctl --user -u docker -f
```

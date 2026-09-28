# gus: 8 TB USB disk

**Status: failed its extended self-test on 2026-09-28. Do not put data on it.**
It is under Seagate warranty until 2028-06-24; see [Failure](#failure).

## Hardware

- Seagate **SkyHawk AI** `ST8000VE001` (part `3CC101-300`, firmware `EV01`),
  7200 rpm, 3.5", 10 heads, made in February 2023.
- Ugreen USB 3 to SATA adapter (ASMedia ASM1153) with its own 12 V power supply.
  Runs at USB 3 speed (5 Gbps) with the UAS driver, and passes SMART through,
  so `smartctl` works as it would on a SATA port.
- Bought second-hand. It came with a BitLocker volume from someone's Windows PC,
  wiped on 2026-09-27.

The label prints a PSID next to the WWN. It cannot unlock data, but anyone
holding the disk can factory-wipe it with it, so crop it out of any photo.

## Setup on gus

One GPT partition, ext4, label `SkyHawk8tb`, no reserved blocks (`-m 0`, which
would otherwise hold back about 400 GB), mounted at `/mnt/SkyHawk8tb`.
`~/SkyHawk8tb` on the `ansible` user is a symlink to the mount point.

The `/etc/fstab` line goes by UUID, so it does not matter which `sd*` name the
disk gets, and carries `nofail`, so gus still boots with the disk unplugged:

```
UUID=<uuid> /mnt/SkyHawk8tb ext4 defaults,noatime,nofail,x-systemd.device-timeout=10s 0 2
```

After formatting, ext4 kept initialising its inode tables in the background
(`ext4lazyinit`) for about 6 hours. That is deliberate throttling
(`init_itable=10`) and the disk is usable meanwhile.

## Unplugging it

- **At boot** it is harmless: `nofail` makes the disk optional, so gus boots
  without it and the mount is simply missing. Without `nofail` a missing disk
  drops the box into emergency mode.
- **While running**, unmount first, `sudo umount /mnt/SkyHawk8tb`, or whatever
  is mid-write can be lost and the filesystem may need a repair. Plugged back in,
  `sudo mount /mnt/SkyHawk8tb` or a reboot brings it back.
- **While it is not mounted**, `/mnt/SkyHawk8tb` and the symlink are an empty
  folder on the 240 GB system SSD. Anything written there, a backup job say,
  would quietly fill the system disk. The empty mount point is `chattr +i`, set
  while unmounted, so those writes fail loudly; the mounted disk is unaffected.
  To rename or remove the folder, unmount and `sudo chattr -i` it first.
- **Moving it**: never while it spins. Unmount, unplug the power, wait about 10
  seconds. Lie it flat, or on its long edge in a stand, never on the connector end.

## Checking it

`~/Makefile` on gus wraps the checks; it addresses the disk by serial and
label, not `sdX`.

| Target | What it does |
|--------|--------------|
| `make` | Everything at a glance: space, temperature, health, self-test, format |
| `make temp` | Temperature with a verdict |
| `make health` | SMART verdict and the counters that predict failure |
| `make selftest` | Start the 12 h surface read, plus a keep-alive (see below) |
| `make selftest-status` | Progress of a running test, results of past ones |
| `make selftest-abort` | Stop a running test and the keep-alive |
| `make format-status`, `make format-progress` | The background ext4 initialisation |

The underlying commands:

```sh
sudo smartctl -x -d sat /dev/sdb       # everything, what CrystalDiskInfo shows and more
sudo smartctl -l farm -d sat /dev/sdb  # Seagate's own log; catches reset SMART hours
sudo smartctl -t long -d sat /dev/sdb  # full surface read, about 12 h, non-destructive
```

**Self-tests abort on an idle disk.** The first extended test was logged as
`Aborted by host` within five minutes of the disk going idle, with no abort
sent; most likely the ASMedia bridge put the disk to sleep. With a read a
minute the next one ran until it hit a real error. `make selftest` therefore starts a transient systemd
unit, `skyhawk-keepalive`, that reads one sector a minute for up to 13 hours.

**Reading the numbers.** The huge raw values on attributes 1, 7 and 188 are
Seagate packing several counters into one number, not errors. Watch 5, 197 and
198: anything above 0 there means the disk is starting to go. `btop` shows the
disk's space and I/O, but not its temperature: the bridge does not expose it to
the `drivetemp` sensor, so only `smartctl` can read it.

**Temperature.** The drive's limit is 70 °C; 30–45 °C is the healthy range and
above 50 °C needs airflow. It sits at about 26 °C idle and settles at 43 °C
under hours of continuous work, lying flat on a silicone mat with no fan. A
closed box would make it hotter; an open stand in PETG or ASA (PLA softens near
55 °C), or a USB fan, would make it cooler.

## Baseline on 2026-09-27

| What | Value |
|------|-------|
| SMART overall | PASSED |
| Power-on hours | 1 324 (about 55 days), same in the FARM log, so not reset |
| Power cycles | 100 |
| Written / read | 6.8 TB / 110 GB |
| Reallocated, pending, uncorrectable sectors | 0 / 0 / 0 |
| Interface CRC errors | 0 |
| Temperature | 27 °C, 55 °C lifetime max, 51 °C long-term average from its previous life |

Sequential speed, read straight from the device with `dd iflag=direct`, and
written as a 4 GB file:

| Where | Speed |
|-------|-------|
| Read, start of the disk | 264 MB/s |
| Read, middle | 223 MB/s |
| Read, end | 129 MB/s |
| Write | 248 MB/s |

The adapter is not the limit: USB 3 leaves room for about 400 MB/s.

## Failure

On 2026-09-28 the extended self-test ended with `Completed: read failure`
after less than 10 % of the surface, at LBA 206 650 288, about 105 GB in.

| Counter | 2026-09-27 | 2026-09-28 |
|---------|-----------|-----------|
| Current pending sectors (197) | 0 | 8 |
| Offline uncorrectable (198) | 0 | 8 |
| Reallocated sectors (5) | 0 | 0 |
| FARM reallocation candidates | 0 | 8 |

A direct read of that LBA from gus fails too (`critical target error`), after
18 seconds of retries that are loud enough to hear. The test stops at the first
failure, so 8 is a floor, not a count.

It had been making a loud scraping sound on reads since the format; that sound
is the drive retrying. New bad sectors on a disk with 1 340 hours, together
with that noise, point to a surface or head problem, which tends to spread.

The full `smartctl` and FARM output from that day, serial and WWN removed, is
in [skyhawk-ai-8tb-hdd-smart-2026-09-28.txt](skyhawk-ai-8tb-hdd-smart-2026-09-28.txt).
The unredacted copy, for the claim, is on gus as
`~/skyhawk8tb-smart-2026-09-28-full.txt`.

## What next

The warranty belongs to the disk, not the buyer, so a second-hand disk can be
claimed.

1. **SeaTools on Windows**, through the same adapter: the *Long Generic* test
   reaches the failure within minutes. Keep the screenshot with the test code;
   Seagate support usually asks for it. Cancel if Windows offers to initialise
   the disk.
2. **Claim it** at Seagate, *Warranty and Replacements*. Pack it in an
   anti-static bag with about 5 cm of padding on every side.
3. When the replacement arrives, change the serial in the Makefile's `DISK`
   and redo the setup above.

Repairing it is possible and would make it pass: writing the whole disk once
(about 11 hours) makes the drive swap every bad sector for a spare, then the
filesystem is recreated and the long test rerun. Do SeaTools **first**, because
afterwards the disk will likely pass it, and the claim is harder without a
failure from Seagate's own tool. A repaired disk is only fit for data that has
a copy elsewhere, with `make health` checked weekly; if the reallocated count
keeps growing, claim it.

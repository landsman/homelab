# NAS

I wanted to build a custom NAS for my local network, primarily to serve media to an Apple TV.
My goal was to have a fast drive capable of delivering large files (like 4K video content) at high speed.


## v1

| Component                                                      | Type             | Link                                                                                                                                                                 |
|----------------------------------------------------------------|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Raspberry Pi 5, 8 GB RAM                                       | Computer         | [link](https://rpishop.cz/raspberry-pi-5/6498-raspberry-pi-5-8gb-ram.html)                                                                                           |
| Raspberry Pi 5 Active Cooler                                   | Cooling          | [link](https://rpishop.cz/chladice-pro-raspberry-pi-5/6496-raspberry-pi-5-active-cooler.html)                                                                        |
| Suptronics - X1016 PCIe 3.0 (4x M.2 NVMe SSD Shield)           | Storage Board    | [discussion](https://github.com/geerlingguy/raspberry-pi-pcie-devices/issues/618), [shop](https://rpishop.cz/604155/suptronics-x1016-pcie-3-na-4slotovy-m-2-shield/) |
| Raspberry Pi 64 GB microSD, A2                                 | Storage for OS   | [link](https://rpishop.cz/535862/raspberry-pi-64-gb-microsd-karta-tridy-a2/)                                                                                         |
| 2x SSD Kingston NV3 2TB                                        | Storage for Data | [link](https://www.alza.cz/kingston-nv3-2tb-d12487073.htm)                                                                                                           |
| Suptronics - DC adapter 12V/5A for CM5 IO board PSU12V5A       | Power Supply     | [link](https://rpishop.cz/611728/suptronics-napajeci-adapter-psu12v5a/)                                                                                              |
| Geekworm - X1011-C1 Metal Case for Raspberry Pi 5 X1011 Shield | Case             | [link](https://rpishop.cz/560336/geekworm-x1011-c1-metal-case-pro-raspberry-pi-5/)                                                                                   |
| Raspberry Pi 5 RTC battery                                     | BIOS Battery     | [link](https://rpishop.cz/knoflikove/6499-raspberry-pi-5-rtc-baterie.html)                                                                                           |
| PremiumCord Flexi HDMI Type A female - micro HDMI Typ D male   | Video Adapter    | [link](https://rpishop.cz/499888/premiumcord-flexi-adapter-hdmi-typ-a-samice-micro-hdmi-typ-d-samec-pro-ohebne-zapojeni/)                                            |

The first build works really well! The only issue is the case: there’s almost no space above the M.2 drives, which generate a lot of heat. 
I had to adjust the cooler settings to run constantly; otherwise, temperatures would exceed 75 °C, which made me uncomfortable.

### SSD board

Without this configuration, the Pi shows a desktop warning about insufficient power. However, this is incorrect — we’re using a DC jack, not USB-C, and the board is powered via pogo connectors.
This setting informs the Pi that it is receiving adequate power.

```dotenv
# sudo rpi-eeprom-config -e

[all]
BOOT_UART=1
BOOT_ORDER=0xf461
NET_INSTALL_AT_POWER_ON=1
PSU_MAX_CURRENT=5000
```

`BOOT_UART=1`
- Enables the UART (serial) console during boot.
- Useful for debugging with a serial cable.

`BOOT_ORDER=0xf461`
- Value 0xf461 is a bitmask. Here’s how it decodes:
- 0x1 = SD card
- 0x4 = USB boot
- 0x6 = Network boot (PXE)
- 0xf = Retry loop
- So, boot tries: SD → USB → Network → Loop (if failed).

`NET_INSTALL_AT_POWER_ON=1`
- Runs the Raspberry Pi Imager (network installer) automatically on power-on if no OS is found.
- Good for headless setup via Ethernet.

`PSU_MAX_CURRENT=5000`
- Sets the max allowed current from the power supply to 5000mA (5A).
- Needed if you’re using high-power USB devices (e.g. SSDs) directly on the Pi.

### RAID

> For Docker storage configuration on this RAID, see [docker/README.md](../docker/README.md).

You need to mount your SSD and configure it to mount automatically on every reboot.

First, you have to decide how important your data is. 
**If a drive fails, are you okay with losing all data, or do you need a backup?**

| RAID Type | Capacity | Data Protection                  | Performance                                        |
|-----------|----------|----------------------------------|----------------------------------------------------|
| RAID 1    | 2 TB     | Yes, mirroring (1 disk can fail) | Better read speed, write same as single disk       |
| RAID 0    | 4 TB     | No, no protection                | Maximum speed, but total data loss if 1 disk fails |

I chose to live with the risk, so I didn’t use any RAID (4 TB). 
If you need redundancy, go with at least RAID 1 (2 TB).

If you don't need any backup like me, you can do RAID 0:

```bash
sudo apt update
sudo apt install mdadm

# list devices
lsblk

# NAME        MAJ:MIN RM  SIZE RO TYPE  MOUNTPOINTS
# mmcblk0     179:0    0 58.9G  0 disk
# ├─mmcblk0p1 179:1    0  512M  0 part  /boot/firmware
# └─mmcblk0p2 179:2    0 58.4G  0 part  /
#
# nvme0n1     259:0    0  1.8T  0 disk
# nvme1n1     259:2    0  1.8T  0 disk

# ⚠️ This will erase data on both drives.
sudo mdadm --create --verbose /dev/md0 --level=0 --raid-devices=2 /dev/sda /dev/sdb

# check status
cat /proc/mdstat

# create file system
sudo mkfs.ext4 /dev/md0

# create mount point
sudo mkdir -p /mnt/raid0

# get uuid
sudo blkid /dev/md0

# put this UUID into
sudo nano /etc/fstab
# UUID=8e6f2663-8622-4f5e-92fa-2fabb9e3ac40 /mnt/raid0 ext4 defaults,noatime,nofail 0 0

# save raid config
sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf
sudo update-initramfs -u

# test
df -h

# Filesystem      Size  Used Avail Use% Mounted on
# udev            3.9G     0  3.9G   0% /dev
# tmpfs           1.6G  9.0M  1.6G   1% /run
# /dev/mmcblk0p2   58G   11G   44G  20% /
# tmpfs           4.0G  656K  4.0G   1% /dev/shm
# tmpfs           5.0M   48K  5.0M   1% /run/lock
# /dev/mmcblk0p1  510M   80M  431M  16% /boot/firmware
# /dev/md0        3.6T  2.1T  1.4T  59% /mnt/raid0
# tmpfs           807M  720K  806M   1% /run/user/1000

# test mount without rebooting
sudo mount -a

# check if its mounted
df -h | grep raid0

# now reboot
sudo reboot

# create symlink for this drive to be easier to find in my home folder as "nas"
ln -s /mnt/raid0 ~/nas

# fix ownership
sudo chown -R pi:pi /mnt/raid0/*
sudo chgrp -R users /mnt/raid0
sudo chmod -R 775 /mnt/raid0
sudo usermod -aG users pi
```

### Fan speed:

This will keep the fan completely off until the Pi reaches 55°C, which is perfectly safe for the hardware.

```bash
# nano /boot/firmware/config.txt

# improve fan speed
dtoverlay=rpi-power-fan

# 1st cooling level (Quiet start)
dtparam=fan_temp0=55000          # Start fan at 55°C
dtparam=fan_temp0_hyst=5000      # Stop fan when it drops to 50°C
dtparam=fan_temp0_speed=75       # Low, barely audible whisper

# 2nd cooling level (Moderate)
dtparam=fan_temp1=65000          # Increase speed at 65°C
dtparam=fan_temp1_hyst=5000      # Drop back to level 1 at 60°C
dtparam=fan_temp1_speed=125      # Medium speed

# 3rd cooling level (High Performance)
dtparam=fan_temp2=72000          # Increase speed at 72°C
dtparam=fan_temp2_hyst=5000      # Drop back to level 2 at 67°C
dtparam=fan_temp2_speed=185      # High speed

# 4th cooling level (Full Power)
dtparam=fan_temp3=80000          # Max cooling at 80°C (thermal throttling limit)
dtparam=fan_temp3_hyst=5000      # Drop back to level 3 at 75°C
dtparam=fan_temp3_speed=255      # Full 100% speed
```

After changes, you have to reboot to apply them: `sudo reboot`.

Monitoring:

```bash
# current fan speed
cat /sys/devices/platform/cooling_fan/hwmon/*/fan1_input

# current fan speed with 1s update
watch -n 1 cat /sys/devices/platform/cooling_fan/hwmon/*/fan1_input

# current fan level
cat /sys/class/thermal/cooling_device0/cur_state

# check cpu temperature and fan speed
vcgencmd measure_temp | cut -d'=' -f2
```

### NAS

Install **Samba** for sharing data with macOS or other devices

```bash
sudo apt update
sudo apt install samba samba-common-bin
sudo systemctl enable smbd
sudo systemctl start smbd

mkdir -p /home/pi/shared
chmod 777 /home/pi/shared
```

Samba config
```bash
sudo nano /etc/samba/smb.conf
```

You can configure shared folders. 
The first folder is on internal micro sd card, the second one on SSDs.

```
[share]
    path = /home/pi/shared
    read only = no
    public = yes
    writable = yes

[ssd]
   path = /mnt/raid0/nas
   browseable = yes
   read only = no
   guest ok = yes
   create mask = 0666
   directory mask = 0777
   force user = pi
```

now configure samba user password (different from OS user)
```bash
sudo smbpasswd -a pi
```


Apple TV

```bash
sudo apt update
sudo apt install minidlna
sudo nano /etc/minidlna.conf
```

content
```dotenv
media_dir=V,/home/pi/nas/video
media_dir=P,/home/pi/nas/photos
media_dir=A,/home/pi/nas/music
db_dir=/var/cache/minidlna
log_dir=/var/log
friendly_name=RaspberryPiNAS
inotify=yes
```

```bash
sudo systemctl restart minidlna
sudo systemctl enable minidlna

# Rebuild media DB
sudo minidlnad -R
```

Ensure Network Visibility
- Make sure your Raspberry Pi and Apple TV are on the same network.
- Allow 1900/UDP and 8200/TCP through the firewall if enabled.

If you want to browser your NAS in Windows PC, you have to install other things:

```bash
sudo apt install wsdd
sudo systemctl enable wsdd
sudo systemctl start wsdd
```


### Recommended Apps

- Use [Infuse app](https://firecore.com/infuse) on Apple TV (or any other device) for the best content viewing experience. Highly recommended — it’s excellent.
- Set up [Tailscale VPN](https://tailscale.com) to make your Pi an exit node. Even on the free tier, you can access it from anywhere or proxy into your homelab network. It also runs on Apple TV and has a simple GUI.
- Send files via [LocalSend](https://localsend.org/?ref=selfh.st) between Pi Desktop and macOS/iPhone/Linux/Windows.



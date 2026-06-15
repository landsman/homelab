# Pollos

pollos is my homelab — a small cluster of Debian 13 boxes where every node is named after a Breaking Bad character (walter, jesse, mike, gus…). 
Pretty hostnames make each box easy to spot and a joy to SSH into. 
The scripts in [setup](setup) folder take a fresh Debian install and turn it into another member of the family.

You can easily install them from microsite: https://www.pollos.cz

The boxes boot into the `powersave` CPU governor; [setup/governor.sh](setup/governor.sh) `install` pins them to `performance` across reboots (`sudo governor powersave` to back off).

## HW

- 4x HP ProDesk 600 G3 Mini i5-6500T (4 cores / 4 threads, 2.5–3.1 GHz)
- 4x SATA SSD Kingston 240GB
- 32GB DDR4 SO-DIMM per node (2x 16GB), running at 2133 MHz:

| Node   | DIMM1 / DIMM3       | Part              | Rank | ECC         | Speed |
|--------|---------------------|-------------------|------|-------------|-------|
| gus    | Kingston / Kingston | KF3200C20S4/16G   | 1    | no          | 2133  |
| mike   | Micron / Micron     | 18ASF2G72HZ-2G3B1 | 2    | yes (inert) | 2133  |
| walter | Micron / Micron     | 18ASF2G72HZ-2G3B1 | 2    | yes (inert) | 2133  |
| jesse  | Micron / Micron     | 18ASF2G72HZ-2G3B1 | 2    | yes (inert) | 2133  |

![stack photo](microsite/src/assets/img/stack-photo.jpg)

## SSH

```yml
# ~/.ssh/config

# Each box is reachable two ways and ssh picks automatically:
#   1. on the home LAN -> direct to its 192.168.0.x IP. A 1s `nc` probe in the
#      Match blocks decides this; works even with Tailscale off on this Mac.
#   2. anywhere else    -> Tailscale MagicDNS name (== hostname), connected
#      directly over the LAN at home or via the encrypted tunnel away.
# "First obtained value wins": when the probe succeeds the Match block sets the
# LAN IP first; otherwise it falls through to the MagicDNS name below. So the
# raw IP is the fallback whenever Tailscale isn't up. No exit node or subnet
# routes needed. Boxes join the tailnet via setup/005-tailscale.sh.

# LAN-first: use the raw IP when the box answers on the home network
Match host gus.pollos    exec "nc -z -w1 192.168.0.115 22"
  HostName 192.168.0.115
Match host mike.pollos   exec "nc -z -w1 192.168.0.113 22"
  HostName 192.168.0.113
Match host walter.pollos exec "nc -z -w1 192.168.0.116 22"
  HostName 192.168.0.116
Match host jesse.pollos  exec "nc -z -w1 192.168.0.117 22"
  HostName 192.168.0.117

# fallback: Tailscale MagicDNS (direct over LAN at home, tunnel when away)
Host gus.pollos
  HostName gus

Host mike.pollos
  HostName mike

Host walter.pollos
  HostName walter

Host jesse.pollos
  HostName jesse

Host *.pollos
   User ansible
   # stored in 1password
   IdentityFile ~/.ssh/id_ed25519_homelab
   IdentitiesOnly yes
```

### Ports

| Port | Service        | Notes                                              |
|------|----------------|----------------------------------------------------|
| 8004 | whisper-server | speech-to-text API, 127.0.0.1 only — SSH tunnel in |

## Apps

### Speech-to-text (whisper)

[../whisper](../whisper) — docker app wrapping [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
`whisper-server` with the multilingual `large-v3-turbo-q8_0` model. On-demand: start it when
needed, stop it to free ~1.5 GB RAM; monitor with lazydocker or `make logs`.

```sh
ssh walter.pollos 'cd whisper && make up'

ssh -L 8004:127.0.0.1:8004 walter.pollos
curl -F file=@video.mp4 -F response_format=srt -F language=cs http://127.0.0.1:8004/inference

ssh walter.pollos 'cd whisper && make down'
```

See [../whisper/README.md](../whisper/README.md) for setup and all options.


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

# Every box is a Tailscale node, reachable by its MagicDNS name (== hostname).
# Keep Tailscale running on this Mac and one config works everywhere: at home
# Tailscale connects directly over the LAN at full speed, away it falls back to
# the encrypted tunnel — no exit node or subnet routes needed. Boxes join the
# tailnet via setup/005-tailscale.sh.
#
# (No per-host LAN probe on purpose: probing 192.168.0.x:22 adds a 1s timeout to
#  every connection when away, and on a foreign 192.168.0.0/24 network — hotel,
#  cafe — it can succeed against a stranger's box and trip host-key verification.
#  If Tailscale is ever off, the boxes are still reachable on the home LAN by raw
#  IP: gus 192.168.0.115, mike 192.168.0.113, walter 192.168.0.116,
#  jesse 192.168.0.117.)

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


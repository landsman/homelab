# 2026-11-17: saul's CI runner went offline after the router handed saul a new address

| Item | Value |
|---|---|
| Window | 2026-11-17 18:16 to 18:32 UTC (19:16 to 19:32 Prague) |
| Affected | the Forgejo runner on saul, the only one with the `deploy` label |
| Detected by | a person, from Forgejo showing the runner offline, about 15 min after it started; nothing alerted |
| Sources | BetterStack incidents, the runner's container log, dhcpcd, tailscaled and cloudflared journals on all five boxes, `ss` inside the runner's network namespace |
| Status | runner restarted; the cause (no DHCP reservation for saul) is still open |
| Written | 2026-11-17 |

## 1. Summary

The router answers saul's DHCP renewal with a NAK after each time it drops off the LAN, and saul
comes back on a different address. At 18:16:26 UTC that happened for the second time that day; the
runner's one connection to the forge was left on the old address, every task fetch went into it
and timed out, and Forgejo marked the runner offline. Restarting the container fixed it at 18:32.
The NAK and the address change are confirmed from the journal; that saul is missing a DHCP
reservation on the router is inferred (the router's settings were not read).

Impact: no deploy could start for about 15 minutes; none was waiting as far as is known. No data
lost. It needed a person, though the kernel may have dropped the dead connection on its own at
about the same moment (see limits).

## 2. Impact

| Service | Effect |
|---------|--------|
| runner on saul (`deploy`, `saul` labels) | took no job from 18:16:57 to 18:32:01 UTC |
| everything else on saul | cloudflared and tailscaled reconnected on their own within 20 s |
| gus, mike, walter, jesse | not affected by the address change: they kept their address |

## 3. Timeline

| Time (UTC) | Event | Source |
|------------|-------|--------|
| 03:00:24 | router unreachable on the LAN from every box, back at 03:01:18 | dhcpcd journal on gus, walter, saul |
| 04:31:20 | saul's renewal NAKed by the router; saul leases a new address | dhcpcd journal on saul |
| 16:50:41 | BetterStack: every pollos box, the NAS and git.insuit.cz down (530 and 502) | BetterStack incidents |
| 16:50:43 | router unreachable on the LAN from every box | dhcpcd journal on all boxes |
| 16:50:47 | runners on walter and jesse start failing to fetch tasks | runner logs |
| 17:05:43 | router reachable again | dhcpcd journal on all boxes |
| 17:08 to 17:15 | BetterStack monitors resolve | BetterStack incidents |
| 17:47 to 18:03 | saul's runner takes and finishes three jobs | runner log on saul |
| 18:16:26 | saul's renewal NAKed again; dhcpcd drops the address and the default route | dhcpcd journal on saul |
| 18:16:32 | saul leases another new address; tailscaled rebinds | dhcpcd, tailscaled journals |
| 18:16:46 | cloudflared's tunnel connections registered again | cloudflared journal |
| 18:16:57 | runner: `failed to fetch task: deadline exceeded`, then every 30 s | runner log on saul |
| about 18:30 | found: the runner's single connection to the forge has 3625 bytes unacknowledged in its send queue; the forge answers from the same container with a fresh connection | `ss -tnp`, `wget` in the container |
| 18:32:01 | runner container restarted, registers and polls without errors | runner log on saul |

## 4. Cause and evidence

saul has no fixed address on the router: after the router restarts, its next renewal is refused and
it gets a new address, and a long-lived connection made from the old one is left dead.

- saul's dhcpcd logs `NAK: from <router>` twice on 2026-11-17, each at the first renewal after the
  router was unreachable on the LAN (03:00, 16:50). No other box logs a NAK since 16:00, and they
  saw the same router outages.
- The address saul leased at 18:16 is the third since it was set up on 2026-10-28; the other boxes
  have kept theirs.
- `setup/000-info.sh` exists to copy a box's MAC into the router's DHCP reservations. saul was set
  up over SSH ([#520](https://github.com/landsman/homelab/pull/520)), and that step has no trace.
- The runner keeps one HTTP/2 connection to the forge. Through the container's NAT it was tied to
  the old address; after the change nothing answered on it, so the client got no reset, only a
  timeout per request, on the same connection each time. At 17:07, when the outage ended with a
  `connection reset`, the runner did reconnect on its own.

What it was not:

- the disk: 13 % used, 184 GB free;
- memory: 30 GB available;
- the forge or Cloudflare: walter and jesse polled the same host without errors, and `wget` from
  inside saul's runner container got an answer;
- the 16:50 outage directly: saul ran three jobs after it; it is what made the router forget the
  lease, about an hour earlier.

Limits of the data:

- The router's DHCP settings were not read; the missing reservation is inferred from the NAKs.
- Whether the router restarted or only stopped answering at 03:00 and 16:50 is not known; from the
  boxes it looks the same.
- With `tcp_retries2 = 15` Linux gives up on unacknowledged data after roughly 15 minutes, which
  lands at about 18:31, seconds before the restart. The runner may have recovered on its own then;
  the restart came too early to tell.
- Whether the 04:31 address change also stalled the runner is not known: the container was
  recreated by the redeploy below, and its earlier log went with it.

## 5. Current state

At 18:40 UTC: the runner on saul polls without errors. saul was redeployed with `./deploy.sh
saul.pollos` from `main`, so it now runs the `cleanup` service as well; it had been set up before
that service existed. saul still has no DHCP reservation, so the next router restart will move it
again.

## 6. Recommendations

| # | What | Owner | By | Done |
|---|------|-------|----|------|
| 1 | Add a DHCP reservation for saul on the router, from `000-info.sh` on the box | landsman | 2026-11-18 | |
| 2 | Put the reservation into the setup steps at <https://www.pollos.cz/setup/>, which do not mention it since #520 | landsman | with the next change to them | |
| 3 | A runner that stops polling alerts nobody; Forgejo shows it only on the runners page | landsman | when convenient | |
| 4 | A watchdog that restarts the runner on repeated `deadline exceeded`: do nothing for now, the reservation removes the trigger and the kernel drops the connection within about 15 minutes | | | |

Learned: a box whose address can change takes every long-lived connection on it down with it,
and the clients that get no reset never notice.

## Appendix

On saul, as root:

```sh
# every renewal, NAK and new lease
journalctl _COMM=dhcpcd --since -2d -o short-iso | grep -E 'NAK|leased|rebinding'
# when the router dropped off the LAN, on any box
journalctl _COMM=dhcpcd --since -2d -o short-iso | grep -E 'unreachable|reachable again'
# the runner's connections, and what each has waiting to be sent
nsenter -t "$(docker inspect -f '{{.State.Pid}}' forgejo-runner)" -n ss -tnp
```

Note: `journalctl --since` reads local time unless the value ends in `UTC`, and `--utc` changes
only the output.

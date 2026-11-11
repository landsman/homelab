# 2026-10-25: git.insuit.cz down every night during the Forgejo backup

| | |
|---|---|
| Window | daily since 2026-10-25, about 02:00 UTC (03:00 Prague, winter time), 5 to 10 min |
| Affected | git.insuit.cz (Forgejo on the Pi): web, API, git over HTTPS and SSH |
| Detected by | the BetterStack monitor `git.insuit.cz`, an e-mail every night |
| Sources | public status page data (`status.pollos.cz/index.json`), `forgejo/Makefile`, [#489](https://github.com/landsman/homelab/pull/489) |
| Status | fixed in the PR that moves the backup to 03:00 UTC, once `make cron-install` has run on the Pi |
| Written | 2026-11-10 |

## 1. Summary

Forgejo is stopped every night for its backup, and the stop falls outside the maintenance window the
git monitor is muted in, so every night raises an alert. It is not the router reboot: that one is
inside the window and no other monitor on the same network went down. Confirmed from the code and
the status page history; the exact time of each alert was not read (see limits).

Impact: git.insuit.cz unreachable for 5 to 10 min a night, at an hour nobody uses it. No data lost,
no person needed, it comes back on its own.

## 2. Impact

| Service | Effect |
|---------|--------|
| git.insuit.cz | unreachable 5 to 10 min every night, 17 nights out of 17 since 2026-10-25 |
| CI on Forgejo | a job running at that time loses its git server; none known to have failed |
| everything else | not affected: 0 s downtime on every other monitor in the same 30 days |

## 3. Timeline

| Time (UTC) | Event | Source |
|------------|-------|--------|
| 2026-10-21 21:00 | `make backup` starts stopping Forgejo for the copy, so a rollback never restores a database caught mid-write | commit in [#489](https://github.com/landsman/homelab/pull/489) |
| 2026-10-25 | first night down, 300 s; the Pi most likely already ran the branch of #489 | status page history |
| 2026-10-31 20:48 | #489 merged; that night 898 s, the upgrade to 17.0.1 the same evening | GitHub, status page |
| 2026-11-06 onward | most nights 600 s instead of 300 s, the backup growing with the repos | status page history |
| 2026-11-10 | cause found | this report |
| 2026-11-11 02:00 to 02:13 | down again, 13 min | BetterStack incident |
| 2026-11-11 | backup moved to 03:00 UTC, git muted until 03:40 UTC | this PR |

## 4. Cause and evidence

The backup cron runs at `0 3 * * *` in the Pi's local time and stops Forgejo for the copy. 03:00
Prague is 02:00 UTC in winter and 01:00 UTC in summer. The git monitor's maintenance window is
02:55 to 03:10 UTC, set for the router, which reboots at 03:00 UTC. The two never overlap.

- Only git is down. The node monitors, including the Pi that hosts Forgejo, and the other apps
  show 0 s downtime in the same 30 days.
- The downtime carries no maintenance time (`maintenance_duration: 0`), so it happens outside
  the window.
- Nights before 2026-10-25 are clean (the history starts 2026-10-12), and the backup did not stop
  Forgejo before #489.
- The length tracks the backup: one failed check at first, two since the volume grew.

What it was not:

- the router reboot: inside the window, and every other monitor behind the same router stayed up;
- the Pi going down: its own health monitor shows no downtime;
- daylight saving: the first night was the night the clocks went back, but a stop at 01:00 UTC in
  summer would also have missed the window; the trigger is #489.

Limits of the data:

- The BetterStack MCP in this session is connected to another organisation, so the incidents
  themselves (exact start and end) were not read. Times above come from the cron line.
- Downtime is counted in whole failed checks every 300 s, so 300 s means "one check failed",
  anywhere from a few seconds to 5 min of real outage.

## 5. Current state

At 2026-11-10: unchanged. Forgejo still stops at 03:00 Prague and the alert will fire every night
until the fix lands.

## 6. Recommendations

| # | What | Owner | By | Done |
|---|------|-------|----|------|
| 1 | Run the backup at 03:00 UTC, inside the router window (hourly cron that checks the UTC hour, as cron reads local time), and mute git until 03:40 UTC, as the backup grows | landsman | 2026-11-14 | yes |
| 2 | Make `make cron-install` replace the old entry instead of refusing, so changing the schedule is one command | landsman | with 1 | yes |
| 3 | Connect the BetterStack MCP to the homelab team too, so the next report reads the incidents themselves | landsman | when convenient | |

Learned: a change that takes a service down on a schedule changes its monitor's maintenance
window in the same PR. And a cron time is local, a BetterStack window here is UTC; compare
them in one zone.

## Appendix

Downtime per day of the git monitor, from the public status page:

```sh
curl -s https://status.pollos.cz/index.json | python3 -c '
import json, sys
for i in json.load(sys.stdin)["included"]:
    a = i.get("attributes", {})
    if a.get("public_name") == "git.insuit.cz":
        for h in a["status_history"]:
            if h["downtime_duration"]:
                print(h["day"], round(h["downtime_duration"]), h["maintenance_duration"])
'
```

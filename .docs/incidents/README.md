# Incidents

One file per incident, written after it is over, so the next one is found faster and the same
cause is not paid for twice. Copy [TEMPLATE.md](TEMPLATE.md).

## When to write one

- an outage someone noticed: an alert, an e-mail from BetterStack, a service that did not answer;
- an alert that fired when nothing was wrong, or stayed silent when something was;
- data lost, or nearly lost.

A repeat of an incident already filed gets a line in that report's timeline, not a new file.

## Naming

`YYYY-MM-DD-<what-broke>.md`, dated by the first occurrence, in words a search finds:
`2026-10-25-git-down-during-nightly-backup.md`, not `incident-3.md`.

## How it is written

- **The first screen answers "what happened, how bad, is it fixed".** The rest lets anyone recheck
  each claim without asking.
- **Every timeline line says where it comes from**: a BetterStack incident, a log, a commit.
- **The cause is argued, and says whether it is confirmed or inferred.** List what it was not,
  each with the fact that rules it out.
- **A number comes with how it was measured.** A BetterStack downtime is a count of failed checks
  times the check interval, not the real length of the outage.
- **Times in UTC**, with the local time beside it where it matters (cron reads local time).
- **Each recommendation has an owner and a date**, and "do nothing" is one.
- **No blame, no story of the investigation.**
- The repo is public: no IPs, tunnel ids, tailnet names, client names or secrets.

## Index

| Date | Incident | State |
|------|----------|-------|
| 2026-10-25 | [git.insuit.cz down every night during the Forgejo backup](2026-10-25-git-down-during-nightly-backup.md) | fixed |
| 2026-11-11 | [mike stopped resolving tailnet names, and a deploy could not pull its image](2026-11-11-mike-lost-tailnet-dns.md) | fixed, PR open |

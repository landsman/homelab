# What a paid Cloudflare plan would have solved

Every zone here is on the Free plan. This is the list of things actually run into where a paid
plan would have helped, so the decision to upgrade rests on cases, not on a feature table. A
plan is bought per zone; so far every case is on `insuit.cz`.

| Plan     | Price per zone                                    |
| -------- | ------------------------------------------------- |
| Pro      | $20 a month billed annually, $25 billed monthly   |
| Business | $200 a month billed annually, $250 billed monthly |

Read on 2026-11-17 from <https://www.cloudflare.com/plans/network-cdn>. The page calls them
"domain plans" and names no currency beyond the `$`.

## Where it stands

Nothing so far costs more than the workaround took to write. Pro would buy one thing (bot
detection that can be scoped); everything else on the list needs Business. Most of the list can be done on the
box instead, behind Cloudflare, once there is a reverse proxy (below); the upload limit cannot.

## Cases

| Date       | Ran into                                                                                                                                                                              | Needs            | Done instead                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-16 | A registry push through `git.insuit.cz` is refused over 100 MB a request; a JVM app's layer is 106 MiB                                                                                | Business, 200 MB | The registry is published on the tailnet ([forgejo/README.md](../forgejo/README.md)). 200 MB would only move the limit                               |
| 2026-11-17 | A crawler on thousands of addresses, a few requests each. Bot Fight Mode cannot be skipped by a rule, so it would also challenge the runner and the API, and stays off                | Pro              | A Managed Challenge rule with the machine paths listed by hand ([#599](https://github.com/landsman/homelab/pull/599)); it missed `/twirp/` at first |
| 2026-11-17 | The one rate limiting rule counts per address over 10 seconds, which a crawler spread that wide never reaches                                                                         | Pro and up       | Same rule as above                                                                                                                                   |
| 2026-11-17 | `ip.src.is_in_european_union` in a rule                                                                                                                                               | Business         | The countries listed by code. No cost, apart from keeping the list                                                                                   |
| 2026-11-17 | No regex in a rule, so `/<owner>/<repo>/raw/` cannot be told from any path holding `/raw/`                                                                                            | Business         | `contains`, `starts_with`, `ends_with`; the `/raw/` exception was dropped instead                                                                    |
| 2026-11-17 | Analytics cannot filter by query string (`clientRequestQuery`: "does not have access to the field"), so `?go-get=1` could not be counted before deciding on an exception              | not checked      | Decided without the number                                                                                                                           |

Limits in use: 2 of 5 custom rules, 0 of 1 rate limiting rule, on `insuit.cz`.

## What Pro and Business add to those

From Cloudflare's docs on 2026-11-17, only the rows the cases above touch:

| Feature                        | Free                  | Pro                         | Business                     |
| ------------------------------ | --------------------- | --------------------------- | ---------------------------- |
| Custom rules                   | 5, no regex           | 20, no regex                | 100, regex                   |
| Rate limiting rules | 1, counts 10 s, blocks 10 s | 2, counts up to 1 min, blocks up to 1 h | 5, counts up to 10 min, blocks up to 1 day; a counting expression |
| Bot detection                  | Bot Fight Mode, fixed | Super Bot Fight Mode, skippable; "definitely automated" | also "likely automated" |
| Managed rulesets               | the free one          | Cloudflare Managed, OWASP   | same                         |
| Upload per request             | 100 MB                | 100 MB                      | 200 MB                       |
| `ip.src.is_in_european_union`  | no                    | no                          | yes                          |

Sources: [custom rules](https://developers.cloudflare.com/waf/custom-rules/),
[rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[Super Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/super-bot-fight-mode/),
[managed rules](https://developers.cloudflare.com/waf/managed-rules/),
[upload limits](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#upload-limits),
[the EU field](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/ip.src.is_in_european_union/).

Free on every plan and not turned on yet: Block AI bots, AI Labyrinth, a managed `robots.txt`.
They are zone-wide.

## On the box, behind Cloudflare

Cloudflare stays in front. Some of what Free cannot do can be done after it, by a reverse proxy
between `cloudflared` and the services. There is none today (the tunnel connects to each
container directly), so every row starts with adding one.

| Case | On the box | Worth it |
| --- | --- | --- |
| The crawler | [Anubis](https://github.com/TecharoHQ/anubis), a proof-of-work challenge, on the expensive browser routes only | Only if the proxy's log shows crawlers still getting past the Managed Challenge. Codeberg reported in 2025 that it stopped most crawlers; later reports say some solve it |
| Rate limiting | Counters in the proxy, including a shared budget per route class (archive generation for all visitors together) | Yes, once there is a proxy. No plan below Enterprise counts by anything but the address |
| EU and regex | Country stays at the edge; regex matching in the proxy | Geo: the edge wins. Regex comes with the proxy |
| Over 100 MB | Nothing: Cloudflare refuses the request before the box sees it | Only bypassing Cloudflare, as the registry does over the tailnet |
| Analytics by query string | The proxy's access log, kept for weeks | The best first step, since it decides the rest. It sees only what Cloudflare let through |

So the order, if it is built: a proxy with an access log, then counters, then Anubis where the
log shows a need. Not a full WAF (Coraza, BunkerWeb, SafeLine): exploit inspection does nothing
against harmless page views spread over many addresses. Not fail2ban: behind the tunnel its ban
hits `cloudflared`, not the visitor.

- **The proxy trusts `CF-Connecting-IP` only from `cloudflared`**, its actual peer. Anubis's
  Cloudflare example trusts Cloudflare's IP ranges, which is wrong behind a tunnel.
- **Candidates:** Caddy (Anubis documents it; its rate limit module has no tagged release but
  commits into 2026) or nginx (Forgejo documents it). Anubis ships an arm64 image.
- **Grafana Alloy is a telemetry collector, not a proxy.** It could ship the proxy's log to a
  backend, nothing more.

Not measured: memory and CPU on the Pi. From a research on 2026-11-17 whose main sources were
checked: Codeberg's [post](https://blog.codeberg.org/letter-from-codeberg-we-love-our-new-infrastructure.html),
Cloudflare's [rate limiting table](https://developers.cloudflare.com/waf/rate-limiting-rules/),
Anubis's [Cloudflare docs](https://github.com/TecharoHQ/anubis/blob/main/docs/docs/admin/environments/cloudflare.mdx)
and its image manifest.

## Adding a case

One row when a limit of the plan is hit for real: the date, what was being done, the plan that
lifts it, and what was done instead with what that cost. Not a feature that merely looks useful. If the box could do it behind Cloudflare, add it to the table above too.
Update "Where it stands" when a row changes the answer.

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
detection that can be scoped); everything else on the list needs Business.

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
| Rate limiting rules            | 1, 10 s, block 10 s   | 2, block up to 1 h          | 5, block up to 1 day         |
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

## Adding a case

One row when a limit of the plan is hit for real: the date, what was being done, the plan that
lifts it, and what was done instead with what that cost. Not a feature that merely looks useful.
Update "Where it stands" when a row changes the answer.

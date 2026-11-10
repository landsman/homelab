# YYYY-MM-DD: <what broke, in words>

| | |
|---|---|
| Window | <start> to <end> UTC (<local time>), or "daily at ..." for a repeat |
| Affected | <services, hosts> |
| Detected by | <BetterStack monitor, a person, nobody> after <how long> |
| Sources | <BetterStack incidents, logs, status page, commits> |
| Status | <open / fix open in PR / fixed in PR / closed> |
| Written | <date> |

## 1. Summary

What happened, the cause and how sure it is, the impact in numbers. Data lost? Did it need a person?

## 2. Impact

Who could not do what, for how long. One row per service if more than one.

## 3. Timeline

| Time (UTC) | Event | Source |
|------------|-------|--------|
| | first symptom | |
| | detected | |
| | cause found | |
| | fixed | |

## 4. Cause and evidence

The cause in one sentence, confirmed or inferred.

- evidence that separates the suspects
- recurrence: how far back it was checked, and how

What it was not:

- <suspect>: <the fact that rules it out>

Limits of the data:

- <what the sources cannot show>

## 5. Current state

At <time>: what is running, what is still off, what clears on its own and when.

## 6. Recommendations

| # | What | Owner | By | Done |
|---|------|-------|----|------|
| 1 | | | | |

What we learned, in one or two lines a future change should be checked against.

## Appendix

The commands and queries used, so the numbers above can be reproduced.

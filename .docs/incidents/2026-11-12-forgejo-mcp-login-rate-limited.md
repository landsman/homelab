# 2026-11-12: forgejo-mcp unusable on the laptop, and logging in again was refused

| Item | Value |
|---|---|
| Window | 2026-11-12 09:27 UTC to the Authelia restart that deploys the fix |
| Affected | the forgejo MCP in every Claude Code session on one laptop; other devices not |
| Detected by | a Claude Code session: "Too many requests. The endpoint is temporarily unavailable." |
| Sources | `docker logs authelia` on the Pi, the binaries of the running `claude` processes (`lsof`), `authelia/CAVEATS.md` |
| Status | fix in this PR; live once deployed and Authelia restarted |
| Written | 2026-11-12 |

## 1. Summary

The laptop's refresh token was presented a second time, so Authelia revoked the laptop's grant.
Authelia then answers 500 instead of "log in again" (authelia#13390), the sessions retried, and
the retries tripped the token endpoint's rate limit. That limit is per IP, so it also refused the
laptop's fresh login: reconnecting and authenticating again could not help. The revocation is
confirmed in the log; which session reused the token is inferred.

Impact: no Forgejo through the MCP on the laptop for about eleven hours. No data lost.

## 2. Impact

| Service | Effect |
|---------|--------|
| forgejo MCP, laptop | every call failed from 09:27 UTC; a fresh login got 429 from 10:26 UTC |
| forgejo MCP, other devices | not affected: each device has its own client and grant |
| Forgejo itself | not affected |

## 3. Timeline

| Time (UTC) | Event | Source |
|------------|-------|--------|
| 09:27:55 | a refresh token is presented again ("Token is inactive"), the grant is revoked; the next refreshes get 500 | Authelia log |
| 10:26:51 | first `Rate Limit Exceeded` on `POST /api/oidc/token`, bucket 1 | Authelia log |
| 10:26 to 20:39 | 360 refusals in 4 escalating buckets, 299 of them in bucket 4, blocking for up to 53 min (`delay=3200s`) | Authelia log |
| afternoon | reconnect and a new login in Claude Code, refused the same way | the user |
| 20:40 | 47 `claude` processes on the laptop, 3 of them on 2.1.310 | `lsof` |
| 2026-11-12 | the token endpoint's rate limit turned off | this PR |

## 4. Cause and evidence

Authelia rotates the refresh token on each refresh and treats a second use of an old one as a
theft: it revokes the whole grant. The log shows exactly one such reuse, at 09:27:55, and 49
answers of `500` afterwards, all naming the same revoked request id. That 500 is
authelia#13390; a client takes it as transient and retries instead of asking for a login.

Which session reused the token is inferred, not proven. Claude Code refreshes under a file lock
shared by its sessions and re-reads the stored token first, read from 2.1.312. Three sessions
still ran 2.1.310: a session keeps the binary it started with, whatever is installed since.
Those are the likely source.

The login could not recover because the token endpoint's rate limit counts per IP: every
session's retries and the fresh code exchange share one bucket. Every client is public with PKCE,
so the limit guarded no secret, and only the tailnet reaches Authelia.

What it was not:

- forgejo-mcp: its endpoint answered `401` as expected and its metadata `200`;
- Authelia down: `/api/health` answered `OK` throughout;
- too many sessions as such: dozens of sessions on 2.1.312 or later share one lock, and the
  failure needs a stale token, not a count.

Limits: the Authelia log does not say which process sent a request, so the 2.1.310 sessions
are a match by version, not by request.

## 5. Current state

At 2026-11-12: the limit is off in this PR, not yet deployed. The three 2.1.310 sessions still run.

## 6. Recommendations

| # | What | Owner | By | Done |
|---|------|-------|----|------|
| 1 | Turn off the rate limit on `/api/oidc/token`, so recovery is one reconnect | landsman | 2026-11-13 | in this PR |
| 2 | Deploy: `make rsync`, `docker compose restart` on the Pi; the restart also clears the current block | landsman | with 1 | |
| 3 | Restart the sessions on 2.1.310 (`claude --resume`), then authenticate once in `/mcp` | landsman | with 2 | |
| 4 | If a grant is revoked again with every session on 2.1.312 or later, the stale-binary theory is wrong: move to a provider that tolerates a brief refresh token reuse | landsman | on recurrence | |
| 5 | Take the Authelia release that fixes authelia#13390, so a revoked grant asks for a login instead of looping | landsman | when released | |

Learned: a rate limit keyed by IP punishes the one device that is trying to recover. And a
long-running agent session runs the version it started with, not the one installed.

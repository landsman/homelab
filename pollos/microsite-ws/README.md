# microsite-ws

Realtime WebSocket endpoint for the [pollos.cz microsite](../microsite). A
single Cloudflare Worker fronting a Durable Object, served at
**`wss://microsite-ws.pollos.cz`**.

Today it powers **live visitor cursors** (`/cursors`). Routing is path-based, so
more realtime features can share this Worker later without a new deployment.

## How it works

- One Durable Object (`CursorRoom`, room `"global"`) holds every open socket and
  rebroadcasts each cursor move to the others.
- Uses the **WebSocket Hibernation API** — the DO is evicted from memory while
  idle but keeps sockets alive, so an idle page costs ~nothing.
- Cursor coordinates are normalized `0..1` (viewport-relative). The connection
  id is assigned **server-side**, so a tab can't spoof another's cursor.

Client lives in the microsite: [`src/assets/cursors.js`](../microsite/src/assets/cursors.js).

## Free tier — it cannot bill you

Runs on the **Workers Free plan** (SQLite-backed DO via `new_sqlite_classes`).
The free plan has hard daily caps and **no overage billing** — exceeding a limit
errors until 00:00 UTC reset, it never charges. App-level guardrails
(tunables in `src/config.ts`, enforced in `src/cursor-room.ts`) keep us well
under the platform caps and degrade gracefully:

| Guardrail                                          | Value         | Purpose                                                                                                                                                               |
| -------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DAILY_MESSAGE_BUDGET`                             | 1.5M msgs/day | ~75% of the ~2M/day free ceiling; at the budget the room sends `{type:'paused'}`, closes all sockets, and refuses reconnects until an alarm clears it at UTC midnight |
| `MAX_PEERS`                                        | 60            | concurrent cursors per room                                                                                                                                           |
| `SOCKET_REFILL_PER_SEC` / `SOCKET_BUCKET_CAPACITY` | 25 / 40       | per-socket token bucket; a flooding client is disconnected                                                                                                            |

The client also throttles sends, pauses on a hidden tab, and disconnects when
idle — so normal microsite traffic stays nowhere near the caps.

## Develop

```bash
make install
make ci
npm run dev             # local wrangler dev (ws://localhost:8787/cursors)
```

## Deploy

Deployed automatically by `.github/workflows/pollos-deploy.yml` (the `worker`
job runs `wrangler deploy`). The custom domain `microsite-ws.pollos.cz` is
provisioned in Terraform: [`pollos/infra/microsite-ws.tf`](../infra/microsite-ws.tf).

The shared `POLLOS_CZ_CF_API_TOKEN` needs **`Account · Workers Scripts · Edit`**
in addition to its existing scopes (see [`../microsite/README.md`](../microsite/README.md)).

# whisper-queue — implementation plan

Distributed speech-to-text over the `pollos` cluster. One **coordinator** owns a
job queue and splits files; **workers** on each box pull chunks, transcribe them
on their local [whisper](..) server, and submit results. A **TUI** shows
the queue, live progress, and finished transcripts.

Supersedes the laptop-driven [`transcribe-cluster.sh`](../transcribe-cluster.sh):
that needs the laptop online the whole time and pushes work; this is a pull queue
that runs in the cluster and is fire-and-forget.

## Why pull, not push

Push (current script) assigns one chunk per box up front — the slowest box is the
long pole, and a dead box strands its chunk. Pull lets every worker grab the next
chunk the moment it's free: fast boxes do more, a crashed box's lease expires and
the chunk is re-queued. Load-balances itself, self-heals.

## Topology

```
  drop file
     │
     ▼
  inbox/ ─watch─┐
                ▼
        ┌───────────────────────────── COORDINATOR (gus) ───────────────────────┐
        │  • fsnotify inbox → new file                                          │
        │  • ffmpeg: probe + silence-snap split into ~N chunks                  │
        │  • Postgres queue: files + chunk-tasks                                │
        │  • HTTP API (:8005, LAN, bearer token)                               │
        │  • stitch chunk results → done/<name>.txt                            │
        └──────────▲───────────────▲───────────────▲──────────────────────────┘
            claim/result    claim/result    claim/result      (workers connect OUT)
                   │               │               │
              ┌────┴───┐     ┌─────┴──┐      ┌─────┴──┐
              │ WORKER │     │ WORKER │      │ WORKER │   one per box, co-located
              │ walter │     │ jesse  │      │ mike   │   with its whisper :8004
              └────┬───┘     └────┬───┘      └────┬───┘   (localhost only)
                   │ POST http://whisper:8004  (shared docker network)
                   │ progress = elapsed / expected   (ETA estimate)
                   ▼
              transcript chunk ──PUT──▶ coordinator

  TUI (laptop) ──GET /state──▶ coordinator   (over LAN or SSH tunnel)
```

Everything is a container. The worker reaches its box's whisper over a shared
docker network (`http://whisper:8004`), not the host — so whisper's only
host-published port stays `127.0.0.1:8004` (for the existing SSH-tunnel path).
Workers listen on nothing and only call **outbound** (coordinator + whisper). The
single host port published anywhere is the coordinator API on its box.

## Chunking

Coordinator splits each file into **fixed ~5–10 min chunks** (configurable
`CHUNK_SECS`), not one-per-box. More chunks than workers = better load balancing
in a pull model (fast boxes pull more). Cuts snap to silence (ffmpeg
`silencedetect`) so no word splits at a seam — same logic as the existing script.
Tradeoff: more seams = marginally more boundary loss; ~7 min is a good default.

## Job & task lifecycle

```
file:  pending ──split──▶ in_progress ──all chunks done──▶ done
                              └──any chunk hard-fails──▶ failed
task:  pending ──claim──▶ claimed ──start──▶ running ──result──▶ done
          ▲                                    │
          └──────── lease expires (no heartbeat) ───────┘  (re-queued)
```

- **Atomic claim**: `UPDATE tasks SET status='claimed', worker=$1, lease_until=$2
  WHERE id = (SELECT id FROM tasks WHERE status='pending' ORDER BY id
  FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *` — Postgres' canonical queue
  pattern: row locks let many workers claim concurrently and `SKIP LOCKED` steps
  over rows another txn is already taking, so no two workers get the same chunk
  and claims never serialize behind a single writer.
- **Lease + heartbeat**: a running task has a deadline; worker heartbeats while
  transcribing. Missed heartbeat → coordinator flips it back to `pending`. Covers
  crashed worker / rebooted box.
- **Stitch**: when a file's chunks are all `done`, concatenate by chunk index →
  `done/<name>.txt`, mark file `done`. Failures land in `failed/`.

## Coordinator HTTP API (JSON, bearer token)

| Method  | Path                         | Purpose                                                                                     |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `GET`   | `/tasks/claim?worker=<name>` | atomically claim next chunk; `204` if none                                                  |
| `GET`   | `/tasks/{id}/audio`          | download the chunk wav                                                                      |
| `PATCH` | `/tasks/{id}/progress`       | `{percent}` (ETA estimate; or real % if log-tail enabled)                                   |
| `POST`  | `/tasks/{id}/heartbeat`      | renew lease                                                                                 |
| `PUT`   | `/tasks/{id}/result`         | `{text}`; marks done, triggers stitch check                                                 |
| `POST`  | `/tasks/{id}/fail`           | `{error}`; retry or mark file failed                                                        |
| `GET`   | `/state`                     | full snapshot for the TUI (files, tasks, workers)                                           |
| `POST`  | `/files`                     | **upload** a recording (multipart); saves to inbox + enqueues → `202 {id, status:"queued"}` |
| `GET`   | `/files/{id}`                | file status (for clients that poll instead of receiving push)                               |
| `GET`   | `/openapi.json`              | OpenAPI 3.1 spec, generated from the handlers                                               |
| `GET`   | `/docs`                      | Scalar API reference UI (renders the spec; "try it" calls)                                  |

## Ingest (upload) & notifications

**Upload from any device.** `POST /files` takes a **multipart upload** of the
recording (not just a path): the coordinator streams it to `inbox/`, creates the
`files` row + chunk tasks, and returns **`202 Accepted`** with
`{ file_id, name, status:"queued" }` — immediate confirmation it's in the queue.
The inbox drop stays as the local alternative; `GET /files/{id}` lets a client
poll status when it can't receive push.

- **iOS — Apple Shortcut.** A Shortcut we build: _Share Sheet / record →_ "Get
  Contents of URL" → `POST https://gus.<tailnet>:8005/files`, header
  `Authorization: Bearer <token>`, request body = the audio file. It surfaces the
  `202` ("queued") as the result. Works from the share sheet of Voice Memos,
  Files, etc.
- **macOS / other OS.** Same endpoint — a `curl -F file=@rec.m4a` one-liner, a
  Shortcut, or an upload control in the dashboard.
- **Reachability (on VPN).** Expose the coordinator over **Tailscale**
  (`tailscale serve`, like the dashboard / yt-archive already do) so devices on
  the tailnet reach it directly — no public exposure. The optional Cloudflare
  tunnel stays the off-tailnet path.

**Notifications back (push).** The coordinator emits an event on every file
transition — **queued** (also the sync `202`), **processing started** (first
chunk claimed), **done** (`done/<name>.md|txt` ready), **failed** — to a push
channel:

- **Recommended: ntfy** — self-hosted, has iOS/Android apps, dead-simple HTTP
  publish (and itself scriptable from Shortcuts). The coordinator `POST`s to an
  `ntfy` topic on each transition; the user subscribes once on the phone.
  Self-hosted → filenames/transcripts stay on-prem; reachable over the same
  Tailscale VPN.
- Make the notifier **pluggable** (an env-configured URL) so ntfy isn't
  hard-wired — Pushover or a generic webhook drop in the same way.
- Division of labour: the synchronous `202` answers "added to queue"; ntfy
  carries the async started / done / failed the upload connection won't be around
  for.

## Storage

- **PostgreSQL** — an external/managed instance, **not in Docker in production**:
  tables `files`, `tasks`, `workers` (last heartbeat). Row locks + `FOR UPDATE
SKIP LOCKED` give correct concurrent claims, and concurrent heartbeat/progress
  writes don't serialize behind one writer the way SQLite would. The coordinator
  reaches it via `DATABASE_URL` from its env file; only the coordinator talks to
  the DB (workers go through the HTTP API). Survives restart → resume in flight.
  For local dev a throwaway `postgres:18` container is provided in
  [`compose.yml`](./compose.yml) — dev/debug only.
- **Disk** work dir: `inbox/`, `work/<fileid>/chunkNN.wav`, `done/`, `failed/`.

## Stack

**Go**, one binary, three subcommands:

```
whisper-queue coordinator   # HTTP API + OpenAPI/Scalar + Postgres + inbox watcher + splitter + stitcher
whisper-queue worker        # poll/claim + on-demand whisper + chunk download + transcribe + log tail
whisper-queue tui           # Bubble Tea dashboard — local client, or served over SSH (Wish)
```

One binary, three roles, shipped as **containers** — same multi-stage build-on-box
pattern as whisper (`golang:alpine` builder → slim runtime + ffmpeg), targeting
`linux/amd64` (the boxes are x86-64 i5-6500T). The `coordinator`/`worker`/`tui`
split is just the container's command; no host binaries, no systemd, no cross-
compile for deploy (build happens on the box). Cross-compile stays handy only for
running the TUI locally on the Mac.

Native goroutines for the coordinator's concurrent workers; `fsnotify` for the
inbox; `jackc/pgx` (pure-Go Postgres driver, no cgo — static build stays trivial)
for state; `charmbracelet/bubbletea` + `lipgloss` for the TUI, served over SSH
with `charmbracelet/wish` (+ `tsnet` for a tailnet hostname). The coordinator's
HTTP layer uses `danielgtaylor/huma`, so the **OpenAPI 3.1** spec is generated
from the typed handlers (no drift) with request/response validation for free;
**Scalar** renders that spec as the API reference at `/docs`. (CLAUDE.md's
TypeScript rule scopes the web dashboard, not a cluster CLI.)

## Progress

`/inference` returns only at the end, so live % can't come from the HTTP call. Two
options, and the choice is purely about how clean we keep the worker container:

- **ETA estimate (default).** The coordinator knows each chunk's audio duration
  (it cut them); the worker stamps a start time. % = `min(99, elapsed /
(duration × realtime_factor))`, factor ~0.7 for the default model. Zero extra
  privilege — the worker stays a plain HTTP container. Smooth enough for a
  dashboard; flips to 100 % on the real result.
- **Real % (opt-in upgrade).** Mount `/var/run/docker.sock:ro` into the worker
  and tail `docker logs whisper` for `progress = NN%` (the `-pp` flag is already
  on in [whisper/compose.yml](../compose.yml); the server is serial so the
  line is unambiguous). Still all-Docker — same pattern lazydocker uses — but it
  grants the worker docker introspection. Ship it later if the estimate isn't good
  enough.

Either way the worker reports via `PATCH /tasks/{id}/progress`; the coordinator
averages a file's chunks for the overall bar.

## TUI panes

- **Queue** — each file: name, overall % (mean of its chunks), elapsed, state.
- **Chunks** — per selected file: chunk index → worker, % bar, elapsed.
- **Workers** — online/offline (heartbeat age), current chunk.
- **Done** — finished files + path to `done/<name>.txt`.
- Add a file by dropping into `inbox/` (watched) — TUI just reflects it.

Two ways to view it: a **local client** (`whisper-queue tui`) that polls
`GET /state` over LAN / SSH tunnel (or push via SSE / Postgres `LISTEN/NOTIFY`
later), or — better when everything runs in Docker — **served over SSH** (below).

## SSH-served TUI (`ssh` in, get the dashboard)

Yes, this works cleanly even though it's all in Docker — and SSH-serving is
actually the _best_ fit, because there's no local binary to install: the client is
just `ssh`. This is the [terminal.shop](https://charm.land/blog/terminaldotshop/)
pattern (Bubble Tea + Lip Gloss + Wish). The coordinator embeds an SSH server via
[`charmbracelet/wish`](https://github.com/charmbracelet/wish); on connect it hands
the session straight to the Bubble Tea dashboard. Because the server reads the DB
directly, there's no `/state` polling and state is live.

- **How.** `wish.NewServer(WithAddress(…), WithHostKeyPath(…),
WithPublicKeyAuth(…), WithMiddleware(bubbletea.Middleware(handler),
activeterm.Middleware(), logging.Middleware()))`. The `bubbletea` middleware
  gives **each session its own `tea.Program`** wired to the SSH pty (window resize
  handled), so concurrent viewers are fine. It is **not a shell** — Wish serves
  only the TUI, there's no way to drop to a prompt on the box.
- **Auth.** Public-key (`WithPublicKeyAuth`) — authorize the cluster key so only
  your key gets in; on the VPN it's network-gated on top.
- **The "special URL" you want.** SSH has no SNI/Host header, so a hostname must
  resolve to an IP:port that listens for _this_ app — you can't multiplex apps by
  hostname on one shared port the way HTTP does. Two clean ways to get bare
  `ssh whisper-queue` (no `-p`):
  - **Tailscale via `tsnet`** (recommended — you're on VPN): the TUI server joins
    the tailnet as its **own node** and Wish listens on that node's `:22`, so
    `ssh whisper-queue` (MagicDNS) drops you straight into the dashboard — no host
    `:22` conflict, no public exposure. (Charm ships a wish + tailscale example.)
  - **Host `ForceCommand`**: a `Match User tui` block in the box's `sshd_config`
    whose `ForceCommand` attaches to the container TUI — gives `ssh tui@gus` on
    the box's real `:22`, reusing host sshd. No extra dep, but edits host config.
- **Simplest fallback.** Publish Wish on `:2222` from the container →
  `ssh -p 2222 gus.pollos`. Zero proxy, works today.
- **Proxy route (if ever needed).** An SSH reverse proxy like `sshpiper` routes by
  username/key to upstream SSH servers — that's the "proxy" answer, but it's
  overkill for one TUI; `tsnet` is simpler than running a proxy.

## Networking & auth

- **Worker → whisper**: a shared external docker network (`whisper-net`) that both
  the whisper compose and the worker compose join — worker targets
  `http://whisper:8004` over it. One-line addition to whisper's compose; whisper's
  host publish stays `127.0.0.1:8004` (untouched, still SSH-tunnellable).
- **Worker → coordinator**: outbound to `gus.pollos:8005` (LAN bridge egress;
  no inbound on worker boxes). Shared **bearer token** on every request.
- **Coordinator**: binds `0.0.0.0:8005` published on its box only. Allocate
  **port 8005** (next free per [.docs/PORTS.md](../../.docs/PORTS.md)); add it there
  and to this service's README. Optionally a Cloudflare tunnel subdomain →
  `http://gus.pollos:8005` for the TUI from outside the LAN.
- **Coordinator → Postgres**: an external/managed instance (**not in Docker** in
  prod), reached over the LAN/tailnet via `DATABASE_URL` in the same env file as
  the bearer token. Only the coordinator connects.
- **TUI over SSH**: the coordinator's Wish server (see [SSH-served
  TUI](#ssh-served-tui-ssh-in-get-the-dashboard)) is public-key gated; expose it
  either as a `tsnet` tailnet node on `:22` (VPN-only, recommended) or a published
  `:2222`. Its own SSH host key persists on a small volume.

## Worker lifecycle (scale-to-zero)

whisper is the only real RAM cost on a worker box (~1.5 GB resident with the
large-v3-turbo model); the worker process itself is a ~10 MB Go poll loop. Goal:
**idle boxes run only the tiny poller, whisper down**, and whisper comes back the
moment there's work.

**Default (recommended): scale whisper to zero, keep the worker poller up.**

- The worker is always running but cheap. It polls `GET /tasks/claim`; an empty
  queue returns `204` and the worker **backs off** (e.g. 2 s while active → 30 s
  when idle) so it's effectively asleep.
- On the first successful claim it brings whisper up — `docker start whisper` (or
  `compose up`) via the box's `/var/run/docker.sock` — waits for the healthcheck,
  then transcribes. No coordinator round-trip to wake anything: a dropped file
  creates tasks, the next poll claims one, whisper spins up lazily.
- After the queue has been empty for `IDLE_GRACE` (e.g. 5 min) the worker stops
  whisper again. The grace window absorbs bursts and avoids cold-start thrash.
- **Cost**: idle box = the poller only (tens of MB), whisper down (~1.5 GB
  freed). **Cold start**: model load is ~10–60 s on the first chunk after idle —
  negligible for batch transcription, tuned by `IDLE_GRACE`.
- **Privilege**: the worker needs `docker.sock` to start/stop whisper — the socket
  the open decisions flagged, here required not optional. It's local to the box;
  the worker still only calls **outbound** otherwise.

**Can the coordinator start the worker/whisper containers on the _other_ nodes?**
Not directly — **Docker is per-host**: a container on gus has no access to
walter/jesse/mike's Docker daemon on its own. Cross-host start/stop needs one of:

- **Docker-over-SSH** — `docker -H ssh://user@walter compose up -d worker` (the CLI
  tunnels the Docker API over SSH; `DOCKER_HOST=tcp://…:2376` with mTLS is the
  other form). Works and reuses the cluster key, but the coordinator then holds
  **root-equivalent Docker access to every box** — a broad credential that cuts
  against least privilege ([[feedback_least_privilege_iac]]). Plain TCP `2375`
  (no TLS) is a remote-root footgun — never.
- **Per-box agent** — a tiny always-on container per box holding only its _local_
  `docker.sock`; the coordinator asks it to `up`/`down` worker+whisper (it can
  poll outbound, so no inbound port). Each box keeps a narrow credential (just a
  token). This is the clean way to also scale the _worker_ container to zero.
- **Cluster orchestrator** (Swarm / Nomad / k8s) — real cross-host scheduling, but
  a whole control plane for four boxes. Overkill.

**Recommendation: don't.** The default above already gives ad-hoc start where it
matters — each box's always-on poller (~10 MB) brings _its own_ whisper (~1.5 GB)
up on demand and down when idle, with the coordinator never reaching across hosts
(pure pull, outbound-only, narrow per-box token). Centrally launching the worker
container too only reclaims that ~10 MB while adding a broad credential or a
control plane — worth it only if you insist on _bare_-idle boxes, and then via the
per-box agent, not coordinator→every-daemon access.

**Coordinator support.** Expose a cheap `GET /tasks/pending-count` (or enough in
`/state`) so a worker can decide "anything for me?" without claiming, and so the
TUI can show whisper up/down per box.

## Would k3s help? (orchestration alternative)

Short answer: **yes for the mechanics, but it's a platform decision, not a feature
toggle.** k3s (lightweight Kubernetes) is exactly the "cluster orchestrator"
option from above — it would cleanly solve the cross-host question the per-box
agent works around.

**What it buys us**

- **Cross-host scheduling for free** — declare a worker `Deployment`/`DaemonSet`
  and k3s starts/stops pods on any node; no Docker-over-SSH, no per-box agent, no
  central daemon credential. This _is_ the answer to "can the coordinator start
  containers on the other nodes."
- **True scale-to-zero via KEDA** — KEDA has a **Postgres scaler**: a
  `ScaledObject` watching `SELECT count(*) … WHERE status='pending'` scales the
  whisper-worker Deployment 0 → N → 0 on queue depth. That replaces our custom
  poll/back-off + `docker.sock` whisper start/stop with declarative autoscaling —
  the exact "start on new job, kill when drained" behaviour, run by the platform.
- **Self-healing / rescheduling** off dead nodes, **Secrets** for the token,
  **Service DNS** across nodes (replaces `whisper-net` + host IPs), and **Traefik**
  ingress (or the **Tailscale operator**) for the API/TUI.

**What it costs**

- **A whole control plane to run and learn** — manifests/Helm, CNI, RBAC, ingress,
  storage classes, upgrades, `CrashLoopBackOff` debugging. The rest of the homelab
  is plain `docker compose` + rsync; standing up k3s for **one** service is a big
  jump.
- **Image distribution** — compose builds on-box; k3s nodes pull from a
  **registry** (or `ctr images import`). New moving part vs. `make rsync &&
  compose build`.
- **Model files** — the ~1.5 GB ggml model per node becomes a per-node `hostPath`
  PV, an init-container download, or a fat image. Manageable, but more plumbing.
- **Control plane is always-on** — the opposite of "scale everything to zero,"
  though RAM-trivial on 32 GB boxes (~0.5–1 GB server + ~256 MB/agent).

**The queue stays either way.** Even on k3s you keep the Postgres pull-queue +
chunk leases — they do chunk-level load-balancing and retry that k8s doesn't. k3s
only takes over **worker count & placement** (via KEDA), not the work
distribution. Clean split of responsibilities.

**Verdict.** If whisper-queue is your _first_ k8s workload and everything else
stays compose, **don't** adopt k3s just for this — the pull-queue already
self-balances and self-heals at the app layer, and the per-box poller already
frees the RAM that matters, with far less to operate. If you're already minded to
move the homelab to k3s, this service is a great fit and **KEDA's Postgres scaler
is the cleanest possible answer** to the worker-lifecycle question — but adopt it
cluster-wide, not for one service.

## Deployment

Everything is Docker, deployed exactly like the whisper app — `make rsync` the dir
to a box, then `docker compose build && up` on the box (x86-64, so `linux/amd64`
images built natively, no cross-compile). One `whisper/queue/` dir, one app image,
compose profiles selected per box:

- **`coordinator` profile** (run on gus): the API/queue/splitter/stitcher
  container. It connects to an **external Postgres** (not in Docker) via
  `DATABASE_URL` from its env file — no DB container in prod. Mounts `inbox/`,
  `work/`, `done/`, reads its bearer token from the same env file, publishes
  `:8005` (REST API + Scalar at `/docs`), and serves the **TUI over SSH** (Wish on
  a `tsnet` tailnet node, or a published `:2222`) — its SSH host key persists on a
  small volume. Image bundles ffmpeg (for splitting), like whisper's. Needs no
  docker access.
- **`worker` profile** (run on every box, gus included): the poll/transcribe
  container. Joins `whisper-net` to reach `http://whisper:8004`; reads coordinator
  URL + token from an env file. Mounts `/var/run/docker.sock` to start/stop its
  box's whisper on demand (see [Worker lifecycle](#worker-lifecycle-scale-to-zero));
  the same socket also enables the optional real-% progress log-tail.

```sh
# coordinator box (gus), once
cd whisper/queue && make rsync && make up-coordinator

# every worker box
cd whisper/queue && make rsync && make up-worker
```

For **local dev / debugging**, `whisper/queue/compose.yml` brings up just the
database: `docker compose up postgres adminer` → Postgres on `127.0.0.1:5432`,
Adminer on `127.0.0.1:8000`; run the coordinator with `go run` against
`postgres://postgres:postgres@127.0.0.1:5432/whisper_queue`.

- Prereq per box: whisper already set up (`make build && make model`) and joined to
  `whisper-net`.
- **Token**: a generated secret in an env file (mode 600), distributed like the
  SSH key (1Password → rsync), or minted in `pollos/infra` Terraform later. Each
  worker holds only the token — least privilege.
- `make` targets mirror whisper's, fanned across boxes: `up-db` (local-dev
  Postgres + Adminer), `up-coordinator`, `up-worker`, `down`, `logs`, `status`,
  `deploy-workers` (loop rsync+up over all four).

**Config in code, minimal manual steps.** Everything that defines the system lives
in git — `compose.yml`, the `Makefile`, and a checked-in `.env.example` (real
secrets injected, never committed). A single `make deploy` fans rsync + `compose
up` across all boxes; the only by-hand inputs are the one-time secret and the
Tailscale/Cloudflare hostname. This is the "less heavy than k3s" sweet spot. If you
later want real cross-host scheduling without a full control plane, **Docker Swarm**
is the small step up — one `docker stack deploy -c compose.yml` from gus schedules
services across nodes, `docker service scale` adjusts counts, secrets/overlay-net
built in — same compose file, no KEDA-style queue autoscaling. Full Kubernetes is
the [appendix below](#appendix-the-k3s--keda-variant-for-illustration).

## Phases

1. **Scaffold** — Go module, `coordinator|worker|tui` subcommands, config (token,
   coordinator URL, DB URL, chunk size, boxes), `Makefile`, local-dev
   `compose.yml` (Postgres + Adminer).
2. **Coordinator core** — Postgres schema + migrations, inbox watcher, ffmpeg
   silence-split, task creation, `claim` (`FOR UPDATE SKIP LOCKED`)/`result`
   endpoints, OpenAPI 3.1 spec + Scalar UI at `/docs`, stitch. Validate with
   `curl` (and the Scalar "try it" panel) as a fake worker.
3. **Worker** — poll/claim loop, chunk download, whisper call, result submit.
   End-to-end: drop a file → transcript in `done/`, across real boxes. No TUI yet.
4. **Reliability** — heartbeats, leases, dead-task re-queue, `fail` + retry,
   `failed/`.
5. **Progress** — ETA estimate from chunk duration + start time; coordinator
   aggregates per-file %. (Real-% via `docker.sock:ro` log-tail is a later opt-in.)
6. **TUI** — Bubble Tea (queue / chunks / workers / done panes): local client over
   `/state`, **and served over SSH** via Wish (public-key auth, `tsnet` hostname).
7. **Worker lifecycle** — scale-to-zero: worker stays a tiny always-on poller,
   brings whisper up on first claim, stops it after an idle grace. Needs
   `docker.sock` on the worker.
8. **Ingest & notifications** — `POST /files` multipart upload (`202`), `GET
/files/{id}` status, ntfy push on queued/started/done/failed, Tailscale
   `serve`, and the iOS Apple Shortcut.
9. **Harden & ship** — bearer auth, `db`/coordinator/worker compose profiles,
   `whisper-net`, `make` targets, PORTS.md + README, optional Cloudflare tunnel.

Each phase is independently testable; 1–3 already give a working distributed
transcriber, 4–9 make it robust, observable, frugal with RAM, and easy to feed
from a phone.

## Open decisions

- **Coordinator host** — gus (also a worker) vs a dedicated box. Default: gus.
- **Name** — `whisper-queue` vs `whisper-cluster`. (Script is `transcribe-cluster.sh`.)
- **Progress fidelity** — ETA estimate (default, zero privilege) vs real % via
  `docker.sock:ro` log-tail. Start with estimate; upgrade if it feels off.
- **whisper lifecycle** — see [Worker lifecycle](#worker-lifecycle-scale-to-zero):
  scale whisper to zero on idle (frees ~1.5 GB/box) vs leave it up 24/7. Default:
  scale to zero, keep the tiny worker poller up.
- **HTTP layer** — `huma` (OpenAPI 3.1 + validation generated from the handlers,
  Scalar docs, +1 dep) vs hand-rolled `net/http` + a checked-in `openapi.json`.
  Default: huma, so the spec can't drift from the code.
- **Postgres (prod)** — external/managed, **not in Docker** (the compose DB is
  local-dev only): provisioned separately (e.g. in `pollos/infra` Terraform) and
  passed via `DATABASE_URL`. Reusing the Pi's [`database`](../../database) is an
  option but adds a cross-host dependency + per-claim latency. Default: a managed
  instance provisioned in IaC.
- **Notification channel** — ntfy (self-hosted, on-prem, iOS app) vs Pushover
  (hosted) vs a bare webhook. Default: ntfy, behind a pluggable notifier URL.
- **Coordinator exposure** — Tailscale `serve` (VPN-only, for the phone upload)
  vs the Cloudflare tunnel (public). Default: Tailscale; tunnel only if needed
  off-tailnet.
- **TUI SSH entry** — `tsnet` node on `:22` (`ssh whisper-queue`, VPN-only) vs a
  published `:2222` (`ssh -p 2222 gus`) vs host `ForceCommand` on the box's `:22`.
  Default: tsnet; `:2222` as the no-frills fallback.
- **Orchestration** — plain Docker compose + app-level pull queue & scale-to-zero
  (recommended) vs **k3s + KEDA** (see [Would k3s
  help?](#would-k3s-help-orchestration-alternative)). Default: compose; revisit
  k3s only if the whole homelab moves to it.
- **srt/vtt** — text-only for v1; timestamped formats need per-chunk offsetting (later).
- **Model/language per job** — global config vs per-file sidecar (e.g. `name.lang`).
  Default: global, `-l auto` with `cs` override.
- **Keep `transcribe-cluster.sh`** — as the zero-infra fallback, or retire once the
  service lands. Default: keep.

## Post-processing: transcript cleanup → Markdown (recommendation)

Raw whisper output is serviceable but noisy: filler, stutters, mis-hearings, and
— because we cut at silence and may overlap seams — occasional duplicated phrases
at chunk boundaries. A small LLM pass can fix spelling/punctuation, drop noise and
duplicates, and emit a clean **Markdown** file (`done/<name>.md`) next to the raw
`done/<name>.txt`.

**In-queue vs separate service — recommendation: a separate service.**

- _In-queue_ (a `polish` task type after stitch, reusing the lease/retry
  machinery) is tempting, but it couples the transcriber to a second, very
  different runtime — an LLM server with its own model, memory profile, and
  failure modes — and a different scaling story. The transcriber should stay
  single-responsibility: audio → raw text.
- _Separate service_ (**recommended**) — a small `transcript-polish` service in
  its own dir (e.g. `whisper/polish/`), loosely coupled: it consumes finished
  transcripts and writes Markdown back. Independently deployable, its prompt/model
  can evolve without touching the cluster, and it can be turned off entirely.

**Trigger — event-driven but loose.** Simplest: the polish service watches
`done/*.txt` (fsnotify) and writes `*.md` — zero coupling to the queue's
internals. Cleaner: the coordinator fires a Postgres `LISTEN/NOTIFY` (or a
webhook) on stitch-complete that the polish service subscribes to — reuses the DB
we already run.

**Model — local first (Ollama).** Run a local instruct model via **Ollama** on a
box (32 GB RAM, CPU-only i5-6500T — fine for async batch; e.g.
`qwen2.5:7b-instruct` or `llama3.1:8b`). Keeps transcripts on-prem and costs
nothing. Make the endpoint configurable so it can point at a hosted model (e.g.
the Claude API) when you want higher quality/speed and the content isn't
sensitive.

**Chunk-aware cleanup.** Because we already have per-chunk text, long files can be
polished **map-reduce**: clean each chunk within the model's context, then a final
merge pass to smooth seams and de-dup overlaps — avoids blowing the context window
on multi-hour recordings, and directly fixes the boundary duplicates the chunking
introduces.

**Footprint.** Ollama is heavy with a model loaded, so apply the same
scale-to-zero idea: keep the polish service a tiny poller and start/stop the
Ollama container on demand instead of holding a model in RAM between jobs.

---

## Appendix: the k3s + KEDA variant (for illustration)

Not the path we're taking now (default is plain compose, [Deployment](#deployment))
— this is a sketch so the k8s option is concrete. The appeal: **everything is
declarative and in git**, and KEDA does the scale-to-zero for us, including killing
the worker container, not just whisper.

**Cluster bring-up** (one-time, scriptable in `pollos/infra` so it's still
config-in-code):

```sh
# gus — control plane
curl -sfL https://get.k3s.io | sh -
# walter / jesse / mike — agents join gus
curl -sfL https://get.k3s.io | K3S_URL=https://gus:6443 K3S_TOKEN=<node-token> sh -
helm install keda kedacore/keda -n keda --create-namespace
```

**Repo layout** — all manifests in `whisper/queue/k8s/`, applied with one command
(`kubectl apply -k whisper/queue/k8s/`) or auto-synced by Flux/Argo (GitOps).
Secrets stay in git **encrypted** via SOPS or Sealed Secrets — so even secrets are
config-in-code, nothing hand-typed on a box.

**The key piece — KEDA scales workers 0 → N → 0 on queue depth:**

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: whisper-worker }
spec:
  scaleTargetRef: { name: whisper-worker } # the Deployment below
  minReplicaCount: 0 # ← scale to zero when the queue is empty
  maxReplicaCount: 4 # one per box
  cooldownPeriod: 300 # 5-min idle grace before going to 0
  triggers:
    - type: postgresql
      metadata:
        query: "SELECT count(*) FROM tasks WHERE status='pending'"
        targetQueryValue: "1" # ~1 pending chunk per replica
      authenticationRef: { name: whisper-pg-auth } # conn string from a Secret
```

**Worker = whisper as a sidecar in one pod**, so scaling the Deployment to 0 kills
*both* (no `docker.sock`, no custom poll/back-off — k8s owns the lifecycle):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: whisper-worker }
spec:
  replicas: 0 # KEDA owns this number
  template:
    spec:
      initContainers: # fetch the ggml model once per pod (or cache on a node hostPath)
        - name: model
          image: curlimages/curl
          args: ["-fLo", "/models/ggml.bin", "https://…/ggml-large-v3-turbo-q8_0.bin"]
          volumeMounts: [{ name: models, mountPath: /models }]
      containers:
        - name: whisper # worker reaches it on localhost
          image: registry.pollos/whisper:latest
          args: ["-m", "/models/ggml.bin", "--host", "127.0.0.1", "--port", "8004", "-l", "auto"]
          volumeMounts: [{ name: models, mountPath: /models }]
        - name: worker
          image: registry.pollos/whisper-queue:latest
          args: ["worker"]
          env:
            - { name: COORDINATOR_URL, value: "http://coordinator:8005" } # Service DNS, no whisper-net
            - { name: WHISPER_URL, value: "http://127.0.0.1:8004" }
            - { name: TOKEN, valueFrom: { secretKeyRef: { name: whisper-secrets, key: TOKEN } } }
      volumes:
        - { name: models, emptyDir: {} }
```

**Coordinator** — 1 replica pinned to gus (it owns the `inbox/work/done` dir),
external Postgres via `DATABASE_URL`, exposed by a Service + Ingress (Traefik ships
with k3s) or the Tailscale operator for the API (`:8005`) and SSH TUI (`:2222`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: coordinator }
spec:
  replicas: 1
  template:
    spec:
      nodeSelector: { kubernetes.io/hostname: gus }
      containers:
        - name: coordinator
          image: registry.pollos/whisper-queue:latest
          args: ["coordinator"]
          ports: [{ containerPort: 8005 }, { containerPort: 2222 }]
          env:
            - { name: DATABASE_URL, valueFrom: { secretKeyRef: { name: whisper-secrets, key: DATABASE_URL } } }
          volumeMounts: [{ name: work, mountPath: /data }]
      volumes:
        - { name: work, hostPath: { path: /srv/whisper-queue } } # local PV on gus
```

**What this removes vs. compose:** the custom poll/back-off + `docker.sock`
whisper start/stop (KEDA does it), `whisper-net` (Service DNS), and the rsync
fan-out (one `kubectl apply`). **What it adds to operate:** an image **registry**
the nodes pull from, model distribution, and an always-on control plane — the
trade-offs in [Would k3s help?](#would-k3s-help-orchestration-alternative). The
Postgres pull-queue + chunk leases stay exactly as designed; k3s only owns worker
**count and placement**.

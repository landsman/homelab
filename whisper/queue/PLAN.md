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

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/tasks/claim?worker=<name>` | atomically claim next chunk; `204` if none |
| `GET`  | `/tasks/{id}/audio` | download the chunk wav |
| `PATCH`| `/tasks/{id}/progress` | `{percent}` (ETA estimate; or real % if log-tail enabled) |
| `POST` | `/tasks/{id}/heartbeat` | renew lease |
| `PUT`  | `/tasks/{id}/result` | `{text}`; marks done, triggers stitch check |
| `POST` | `/tasks/{id}/fail` | `{error}`; retry or mark file failed |
| `GET`  | `/state` | full snapshot for the TUI (files, tasks, workers) |
| `POST` | `/files` | **upload** a recording (multipart); saves to inbox + enqueues → `202 {id, status:"queued"}` |
| `GET`  | `/files/{id}` | file status (for clients that poll instead of receiving push) |
| `GET`  | `/openapi.json` | OpenAPI 3.1 spec, generated from the handlers |
| `GET`  | `/docs` | Scalar API reference UI (renders the spec; "try it" calls) |

## Ingest (upload) & notifications

**Upload from any device.** `POST /files` takes a **multipart upload** of the
recording (not just a path): the coordinator streams it to `inbox/`, creates the
`files` row + chunk tasks, and returns **`202 Accepted`** with
`{ file_id, name, status:"queued" }` — immediate confirmation it's in the queue.
The inbox drop stays as the local alternative; `GET /files/{id}` lets a client
poll status when it can't receive push.

- **iOS — Apple Shortcut.** A Shortcut we build: *Share Sheet / record →* "Get
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

- **PostgreSQL** — a `postgres:18` container on the coordinator box: tables
  `files`, `tasks`, `workers` (last heartbeat). Row locks + `FOR UPDATE SKIP
  LOCKED` give correct concurrent claims, and concurrent heartbeat/progress
  writes don't serialize behind one writer the way SQLite would. State on a named
  volume → survives restart, resume in flight. Only the coordinator talks to it
  over a private docker network; workers never touch the DB (they go through the
  HTTP API).
- **Disk** work dir: `inbox/`, `work/<fileid>/chunkNN.wav`, `done/`, `failed/`.

## Stack

**Go**, one binary, three subcommands:

```
whisper-queue coordinator   # HTTP API + OpenAPI/Scalar + Postgres + inbox watcher + splitter + stitcher
whisper-queue worker        # poll/claim + on-demand whisper + chunk download + transcribe + log tail
whisper-queue tui           # Bubble Tea dashboard over /state
```

One binary, three roles, shipped as **containers** — same multi-stage build-on-box
pattern as whisper (`golang:alpine` builder → slim runtime + ffmpeg), targeting
`linux/amd64` (the boxes are x86-64 i5-6500T). The `coordinator`/`worker`/`tui`
split is just the container's command; no host binaries, no systemd, no cross-
compile for deploy (build happens on the box). Cross-compile stays handy only for
running the TUI locally on the Mac.

Native goroutines for the coordinator's concurrent workers; `fsnotify` for the
inbox; `jackc/pgx` (pure-Go Postgres driver, no cgo — static build stays trivial)
for state; `charmbracelet/bubbletea` + `lipgloss` for the TUI. The coordinator's
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

Runs from the laptop, polls `GET /state` (or push via SSE / Postgres
`LISTEN/NOTIFY` later) over LAN / SSH tunnel.

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
- **Coordinator → Postgres**: over a private docker network on the coordinator
  box; the DB is **not host-published** (least privilege). Connection string from
  the same env file as the bearer token.

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

**Aggressive variant: scale-to-zero everything (no idle footprint).** Don't keep
even the poller up — the coordinator wakes boxes when the queue goes empty→non-
empty and tears them down when it drains. Either **SSH fan-out** (coordinator
`ssh box 'docker compose up -d worker'`, reusing the cluster key — zero idle
footprint, but the coordinator now holds SSH to every box, a broad credential that
cuts against least privilege, [[feedback_least_privilege_iac]]) or a **tiny wake
endpoint** (a ~MB always-on agent per box exposing an inbound `POST /wake` the
coordinator calls — re-introduces one inbound port the pull model avoided). Net:
this only frees the ~10 MB the poller would use, while adding a broad credential
or an inbound surface — **not worth it** unless you truly want bare-idle boxes;
the default already frees the RAM that matters.

**Coordinator support.** Expose a cheap `GET /tasks/pending-count` (or enough in
`/state`) so a worker can decide "anything for me?" without claiming, and so the
TUI can show whisper up/down per box.

## Deployment

Everything is Docker, deployed exactly like the whisper app — `make rsync` the dir
to a box, then `docker compose build && up` on the box (x86-64, so `linux/amd64`
images built natively, no cross-compile). One `whisper/queue/` dir, one app image,
compose profiles selected per box:

- **`coordinator` profile** (run on gus): a `postgres:18` container (named volume
  for the queue state) + the API/queue/splitter/stitcher container, wired over a
  private docker network so only the coordinator reaches Postgres (not host-
  published). The coordinator mounts `inbox/`, `work/`, `done/`, reads its DB URL +
  bearer token from an env file, and publishes `:8005` (REST API + Scalar at
  `/docs`). Image bundles ffmpeg (for splitting), like whisper's. Needs no docker
  access.
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
6. **TUI** — Bubble Tea over `/state`; queue / chunks / workers / done panes.
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
- **Postgres location** — a dedicated `postgres:18` sidecar on gus (cluster stays
  self-contained) vs reusing the Pi's existing [`database`](../../database)
  service over the LAN (one less container, but the cluster now depends on the Pi
  and adds cross-host latency on every claim). Default: sidecar on gus.
- **Notification channel** — ntfy (self-hosted, on-prem, iOS app) vs Pushover
  (hosted) vs a bare webhook. Default: ntfy, behind a pluggable notifier URL.
- **Coordinator exposure** — Tailscale `serve` (VPN-only, for the phone upload)
  vs the Cloudflare tunnel (public). Default: Tailscale; tunnel only if needed
  off-tailnet.
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

- *In-queue* (a `polish` task type after stitch, reusing the lease/retry
  machinery) is tempting, but it couples the transcriber to a second, very
  different runtime — an LLM server with its own model, memory profile, and
  failure modes — and a different scaling story. The transcriber should stay
  single-responsibility: audio → raw text.
- *Separate service* (**recommended**) — a small `transcript-polish` service in
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
```
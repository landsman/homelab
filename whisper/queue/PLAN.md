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
        │  • SQLite queue: files + chunk-tasks                                  │
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

- **Atomic claim**: `UPDATE tasks SET status='claimed', worker=?, lease_until=?
  WHERE status='pending' ORDER BY id LIMIT 1 RETURNING *` — one SQLite txn, no
  two workers get the same chunk.
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
| `POST` | `/files` | enqueue a file (alternative to inbox drop) |

## Storage

- **SQLite** on the coordinator: `files`, `tasks`, `workers` (last heartbeat).
  Single-writer, perfect for a queue; survives restart → resume in flight.
- **Disk** work dir: `inbox/`, `work/<fileid>/chunkNN.wav`, `done/`, `failed/`.

## Stack

**Go**, one binary, three subcommands:

```
whisper-queue coordinator   # HTTP server + SQLite + inbox watcher + splitter + stitcher
whisper-queue worker        # poll/claim loop + chunk download + whisper call + log tail
whisper-queue tui           # Bubble Tea dashboard over /state
```

One binary, three roles, shipped as **containers** — same multi-stage build-on-box
pattern as whisper (`golang:alpine` builder → slim runtime + ffmpeg), targeting
`linux/amd64` (the boxes are x86-64 i5-6500T). The `coordinator`/`worker`/`tui`
split is just the container's command; no host binaries, no systemd, no cross-
compile for deploy (build happens on the box). Cross-compile stays handy only for
running the TUI locally on the Mac.

Native goroutines for the coordinator's concurrent workers; `fsnotify` for the
inbox; `modernc.org/sqlite` (pure-Go, no cgo — trivial static build) for state;
`charmbracelet/bubbletea` + `lipgloss` for the TUI. (CLAUDE.md's TypeScript rule
scopes the web dashboard, not a cluster CLI.)

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

Runs from the laptop, polls `GET /state` (or SSE later) over LAN / SSH tunnel.

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

## Deployment

Everything is Docker, deployed exactly like the whisper app — `make rsync` the dir
to a box, then `docker compose build && up` on the box (x86-64, so `linux/amd64`
images built natively, no cross-compile). One `whisper/queue/` dir, one image, two
compose profiles selected per box:

- **`coordinator` profile** (run on gus): the API/queue/splitter/stitcher
  container. Mounts `inbox/`, `work/`, `done/`, the SQLite file; publishes `:8005`.
  Image bundles ffmpeg (for splitting), like whisper's. Needs no docker access.
- **`worker` profile** (run on every box, gus included): the poll/transcribe
  container. Joins `whisper-net` to reach `http://whisper:8004`; reads coordinator
  URL + token from an env file. Plain container — no docker socket in the default
  (ETA) progress mode; add `/var/run/docker.sock:ro` only for the real-% upgrade.

```sh
# coordinator box (gus), once
cd whisper/queue && make rsync && make up-coordinator

# every worker box
cd whisper/queue && make rsync && make up-worker
```

- Prereq per box: whisper already set up (`make build && make model`) and joined to
  `whisper-net`.
- **Token**: a generated secret in an env file (mode 600), distributed like the
  SSH key (1Password → rsync), or minted in `pollos/infra` Terraform later. Each
  worker holds only the token — least privilege.
- `make` targets mirror whisper's, fanned across boxes: `up-coordinator`,
  `up-worker`, `down`, `logs`, `status`, `deploy-workers` (loop rsync+up over all
  four).

## Phases

1. **Scaffold** — Go module, `coordinator|worker|tui` subcommands, config (token,
   coordinator URL, chunk size, boxes), `Makefile`.
2. **Coordinator core** — SQLite schema, inbox watcher, ffmpeg silence-split,
   task creation, `claim`/`result` endpoints, stitch. Validate with `curl` as a
   fake worker.
3. **Worker** — poll/claim loop, chunk download, whisper call, result submit.
   End-to-end: drop a file → transcript in `done/`, across real boxes. No TUI yet.
4. **Reliability** — heartbeats, leases, dead-task re-queue, `fail` + retry,
   `failed/`.
5. **Progress** — ETA estimate from chunk duration + start time; coordinator
   aggregates per-file %. (Real-% via `docker.sock:ro` log-tail is a later opt-in.)
6. **TUI** — Bubble Tea over `/state`; queue / chunks / workers / done panes.
7. **Harden & ship** — bearer auth, coordinator + worker compose profiles,
   `whisper-net`, `make` targets, PORTS.md + README, optional Cloudflare tunnel.

Each phase is independently testable; 1–3 already give a working distributed
transcriber, 4–7 make it robust and observable.

## Open decisions

- **Coordinator host** — gus (also a worker) vs a dedicated box. Default: gus.
- **Name** — `whisper-queue` vs `whisper-cluster`. (Script is `transcribe-cluster.sh`.)
- **Progress fidelity** — ETA estimate (default, zero privilege) vs real % via
  `docker.sock:ro` log-tail. Start with estimate; upgrade if it feels off.
- **whisper lifecycle** — leave whisper up 24/7 on worker boxes (4×~1.5 GB of
  32 GB, trivial) vs on-demand up/down (needs worker docker control → socket).
  Default: leave up while the box is a worker.
- **srt/vtt** — text-only for v1; timestamped formats need per-chunk offsetting (later).
- **Model/language per job** — global config vs per-file sidecar (e.g. `name.lang`).
  Default: global, `-l auto` with `cs` override.
- **Keep `transcribe-cluster.sh`** — as the zero-infra fallback, or retire once the
  service lands. Default: keep.
```
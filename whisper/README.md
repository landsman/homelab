# whisper

Speech-to-text API — [whisper.cpp](https://github.com/ggml-org/whisper.cpp) `whisper-server`
with the multilingual `large-v3-turbo-q8_0` model (~874 MB, Czech included).

Own image (see [Dockerfile](Dockerfile)): pinned whisper.cpp version, slim Debian runtime,
runs as `nobody`, built on the box so ggml tunes for the local CPU. Fully local, no cloud.

On-demand app — `restart: "no"`, start it when needed, stop it to free RAM (~1.5 GB).
Monitor with lazydocker, `make logs`, or the compose healthcheck (`/health`).

## Setup (once per box)

```sh
make rsync   # copy this dir to the box (HOST=walter.pollos by default)
ssh walter.pollos
cd whisper && make build && make model
```

## Usage

```sh
# on the box (ansible is in the docker group — no sudo)
make up      # start; healthy once the model is loaded
make down    # stop, free RAM
make logs    # follow transcription progress
make status  # running? healthy?

# from your machine, over an SSH tunnel
ssh -L 8004:127.0.0.1:8004 walter.pollos

curl -F file=@video.mp4 -F response_format=text http://127.0.0.1:8004/inference
curl -F file=@memo.m4a -F response_format=text http://127.0.0.1:8004/inference  # iPhone voice memo
curl -F file=@video.mp4 -F response_format=srt -F language=cs http://127.0.0.1:8004/inference
```

Any audio/video container works — the server extracts/converts via ffmpeg (`--convert`).
Formats: `text`, `json` (default), `verbose_json` (timestamps + segments), `srt`, `vtt`.
Language auto-detects (`-l auto`); override per request with `-F language=cs`.

## Performance (estimates)

Rough expectations on a pollos node (i5-6500T, 4 cores, CPU-only) — transcription speed
relative to recording length; one request processed at a time:

| Model                           | Speed (est.)     | 10 min memo | 1 h video  | Quality (cs)    |
|---------------------------------|------------------|-------------|------------|-----------------|
| `large-v3-turbo-q8_0` (default) | ~0.5–1× realtime | ~10–20 min  | ~1–2 h     | very good       |
| `small`                         | ~2–4× realtime   | ~3–5 min    | ~15–30 min | okay for drafts |
| `base`                          | ~6–10× realtime  | ~1–2 min    | ~6–10 min  | weak for cs     |

Estimates only — measure on the box with `time curl ...` and adjust `MODEL` in the
Makefile + `compose.yml` if the default is too slow for your use.

## Ports

| Port | Service        | Notes                                       |
|------|----------------|---------------------------------------------|
| 8004 | whisper-server | published on 127.0.0.1 only — SSH tunnel in |

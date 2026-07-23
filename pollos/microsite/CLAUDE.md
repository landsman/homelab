# Microsite — notes for Claude

Static site for pollos.cz. Build pipeline: `make build` (clean → rsync `src/` →
`cli/pages.sh` renders pages and generates `public/_headers`). Served locally
with `make dev` (`wrangler pages dev public`). `make test` runs the generator
smoke tests in `tests/`.

## Gotchas

- **`wrangler pages dev` reads `_headers` only at startup.** After a change that
  regenerates `public/_headers` (e.g. adding a setup file via `cli/pages.sh`),
  the already-running `make dev` server keeps serving the OLD headers — restart
  `make dev` to pick them up. Symptom: a file downloads instead of rendering as
  `text/plain` even though the rule looks correct.

- **Setup files under `setup/` are served raw** (`text/plain`, `inline`).
  `cli/pages.sh` gives `.sh` files a stripped alias (`001-init.sh` → also served
  at `/init.sh`); any non-`.sh` file (e.g. `mise.toml`) gets the same
  `hx-boost="false"` listing link plus a per-path `text/plain` rule appended to
  `_headers`. `tests/pages.test.sh` guards these invariants — run `make test`
  after touching `cli/pages.sh`.

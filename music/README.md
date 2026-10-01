# music.insuit.cz

The web app of [landsman/music](https://github.com/landsman/music), served from
Cloudflare Pages instead of GitHub Pages. For now the app is the `app/`
submodule; it is meant to move into this folder outright, the way `insuit/` is.

```
app/      submodule: landsman/music, branch dev — the web app is app/src/web
infra/    Terraform: the two Pages projects, nothing else
Makefile  make build — the site into app/src/web/dist
```

Only the web app moves. Supabase (the database and the edge functions) stays
where it is and keeps deploying from the music repo.

## How a change ships

1. Merge in the music repo.
2. Dependabot opens a `deps(music):` PR here moving the submodule — daily, no
   cooldown. Or move it by hand: `git submodule update --remote music/app`.
3. `music-ci.yml` builds it; a PR opened by a person also gets a preview on
   `<branch>.music-preview.pages.dev` (Dependabot's get no secrets, so no preview).
4. Merging runs `music-deploy.yml`: Terraform, then the build to `music-insuit-cz`.

## Setup

It runs on insuit's Cloudflare account, API token and R2 state bucket (state key
`music-insuit-cz.tfstate`) — see `insuit/README.md`. On top of those, two repo
**variables**, copied from the music repo's `github-pages` environment:

- `MUSIC_SUPABASE_URL`
- `MUSIC_SUPABASE_ANON_KEY` — public, every visitor's browser gets it

## Cutover (manual, once)

`music.insuit.cz` is a CNAME to GitHub Pages in the hand-kept insuit.cz zone,
which Terraform deliberately does not touch (see `insuit/infra/main.tf`).

1. After the first deploy, check `music-insuit-cz.pages.dev`.
2. Pages → `music-insuit-cz` → Custom domains → add `music.insuit.cz`. Cloudflare
   offers to replace the existing CNAME; let it.
3. In the music repo: turn GitHub Pages off and delete
   `.github/workflows/deploy-web.yml`, so the two hosts never both deploy.

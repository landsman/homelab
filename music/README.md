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
`music-insuit-cz.tfstate`) — see `insuit/README.md`. Two additions:

- The token needs **Zone · DNS · Edit** on insuit.cz, on top of what
  `insuit/README.md` lists: this stack owns the `music.insuit.cz` record.
- Two repo **variables**, copied from the music repo's `github-pages` environment:
  `MUSIC_SUPABASE_URL` and `MUSIC_SUPABASE_ANON_KEY` (public, every visitor's
  browser gets it).

## Domain

Terraform owns `music.insuit.cz`: the custom domain on `music-insuit-cz` and its
one CNAME, pointed at the project's pages.dev host. The record existed before
(a CNAME to GitHub Pages); `main.tf` finds it by name and imports it, so the
first apply repoints it instead of failing on a duplicate. No other record in
the insuit.cz zone is touched.

Every deploy and every preview waits until the URL serves this build's entry
script (`scripts/check-site.sh`) before calling itself done or posting a link.

# insuit.cz

Personal site — a home page, what I can be hired for, a contact page and the
CV. React + TypeScript on
TanStack Start with file-based routes, the testing and tooling of
[`dashboard/`](../dashboard), and plain CSS, no Tailwind. **Every page is
rendered to an HTML file at build time**, so its text is in the page source;
React then takes the page over in the browser. Hosted on Cloudflare Pages.

**[Bun](https://bun.com/) is the one tool**: it installs the dependencies, runs
every script and is the runtime they run on (`bunfig.toml`) — the build, the
unit tests, Playwright, Cucumber. Nothing in `make` needs Node. None of it
reaches the site: what is deployed is static files.

```
src/
  routes/             one file per page — TanStack Router, file-based
  routes/__root.tsx   the document around every page: <head>, footer
  routeTree.gen.ts    generated from routes/ by the Vite plugin, never edited
  router.tsx          the router; server.ts is the build-time renderer's entry
  app/                what every page shares: footer, theme toggle, ROUTES, page-meta,
                      the site's address (site.ts), icon and font paths (assets.ts)
  features/<page>/    a page's own components and data
  index.css           stylesheet entry point, @imports only
  styles/             tokens, fonts, reset, page, typography, components/
  paraglide/          the compiled messages — generated, not committed
content/              what the site says, apart from the app in src/
  cv/cv.md            the CV's source — edit this, not the components
  blog/<year>/        the blog's posts, one MDX file each
scripts/              the local preview server, and the check that Pages agrees with it
bunfig.toml           makes Bun the runtime of every script, not only the launcher
messages/en.json      every word of the interface, by key
project.inlang/       the locales, for Paraglide
vite/cv.ts            builds the CV page's data and QR codes from cv.md
vite/blog.ts          compiles each post's MDX, and serves its front matter apart
vite/sitemap.ts       robots.txt and the sitemaps, written into the build
vite/youtube.ts       the thumbnails of the posts' videos, fetched into the build
public/               copied to the site as is
  assets/fonts/       self-hosted Fira Mono (SIL OFL)
  assets/icons/       masked glyphs + favicon
  assets/cv/          the CV's pictures
  _headers            Pages response headers: hashed files are cached for good
tests/                vitest (blog/, cv/, i18n/, preview/), Playwright (e2e/), Cucumber (bdd/)
links/                link.insuit.cz — see below
og/                   the Open Graph card's source
infra/                Terraform: the Pages projects only — see DNS cutover below
```

Every colour, size, spacing and duration lives in `src/styles/tokens.css` — the
other files only reference custom properties.

## Adding a page

1. `src/routes/<name>.tsx` with `createFileRoute("/<name>")` — the route tree
   regenerates while `make dev` runs. Its `head` takes `pageMeta(…)` for the
   title and the link-preview tags — every page needs it: without one a page is
   titled "Page not found", which is what the root route says until a page says
   otherwise.
2. The page itself in `src/features/<name>/`, rendering its own
   `<main className="wrapper">`.
3. Its path in `ROUTES` (`src/app/routes.ts`); link to it with `<Link>`. The
   build finds a page by following links from `/`; one that nothing links to is
   added to `pages` in `vite.config.ts`.
4. Its words in `messages/en.json` (below), an e2e spec and a Cucumber scenario.

Inside `src/`, import through the `@/` alias (`@/app/routes`), never a relative
path — oxlint rejects `./` and `../` there.

A path to an icon or a font under `public/` goes in `src/app/assets.ts`, not
into the component as a literal.

### A page with data

A `loader` runs at build time **and again in the browser** on every in-app
navigation, where there is no file system and no server. So data a page needs
has to be in the bundle: imported, or turned into a module at build time the
way `vite/cv.ts` does for the CV (`virtual:cv`). For a page per file —
`/blog/$slug` from a folder of markdown — that is `import.meta.glob` in the
loader, one chunk per post; the build finds each post by the link to it from
an index page.

### Writing a post

The blog is at `/blog`. No menu links to it yet. Search engines find it through
its sitemap. A post is an MDX file in `content/blog/<year>/`, which is markdown
that takes JSX. The year folder is the year it was published, and it only keeps
the files in order. The address is the file's name alone, in lowercase letters,
digits and dashes: `2026/hello.mdx` is `/blog/hello`. So no two posts may share
a name, whatever their years, and the build stops on two that do. It opens with
its front matter:

```markdown
---
title: Hello
description: One sentence, for the link preview.
lang: en
published: 2026-10-06
updated: 2026-11-02
hidden: true
---
```

- `lang` is `en` or `cs`, the post's own language (`POST_LANGS` in
  `src/features/blog/post.types.ts`). The post is marked up in it, so a screen
  reader reads it right, and its `og:locale` says it too.
- `updated` is optional. Set it by hand when the content changes, not for a
  typo. It is shown under the title, and it dates the post in the sitemap and
  in `article:modified_time`. Git's dates would move on every typo, and CI
  checks out without history anyway.
- `hidden: true` leaves a post out of the list and the sitemap and asks
  search engines to stay out: it is read by its address only. `/blog?qa=true`
  lists it anyway, marked, to check it before it is out. Its title and address
  are in the bundle all the same, so hidden is not secret. `hello.mdx` is one,
  kept for the tests.
- A post missing a required field, in the wrong year's folder, or updated
  before it was published stops the build.

A post uses a component without importing it, e.g. `<YouTube id="…" title="…" />`.
The components it can use are listed in `src/features/blog/components.tsx`. A
video waits as a play button over its thumbnail. `vite/youtube.ts` fetches the
thumbnail from YouTube when the site is built, keeps it in
`node_modules/.cache`, and writes it into the build, never into the repo. A
reader gets it from the site and asks YouTube for nothing until they press
play. A thumbnail that cannot be fetched stops the build. MDX
itself is JavaScript, so a component's types are checked in its own `.tsx`
file and not in the post.

`vite/blog.ts` compiles each post with `@mdx-js/rollup` into a component of its
own. The list carries only the front matter. Each post is a chunk of its own,
yet the build writes its whole text into the page's HTML file. While `make dev`
runs, an edit recompiles that one post.

### Sitemaps

The build writes `robots.txt`, which points at `sitemap.xml`. That is an index
linking `sitemap-pages.xml` and `sitemap-blog.xml`, all on the build's own
`SITE_URL` (`vite/sitemap.ts`). The blog's sitemap lists every post. The
pages' sitemap is a list kept by hand, and it leaves out `/cv`, which asks
search engines to stay out. `make e2e` fails on an address in a sitemap that
is missing or says `noindex`.

### Rendered twice

A page is rendered twice: at build time, where there is no `window`, and in the
browser. Anything that needs the browser — `document`, `localStorage`,
`matchMedia` — goes in an effect or an event handler, and the first render has
to come out the same in both places. `make e2e` fails on a page where it does
not: on the built site for elements and text, and on the dev server
(`tests/e2e/dev/`) for attributes, which only React's development build
reports.

## Localisation

Every word of the interface is a key in `messages/en.json`, used through
Paraglide: `m.home_heading()`, `m.common_video_play({ title })`. A missing key is a
type error. Keys are `<area>_<thing>` — `common_`, `home_`, `hire_`, `contact_`, `cv_`,
`not_found_` — and name the thing, not where it sits.

English is the only locale. A second one is one entry in
`project.inlang/settings.json` plus `messages/<locale>.json`; `make test` fails
until it has every key. How a visitor gets that language — a URL prefix, a
cookie — is the `strategy` in `vite.config.ts`, `baseLocale` until then. The
same strategy is written once more in `package.json`'s `messages` script, which
compiles the catalogue for the type checker; change both.

Not in the catalogue: the CV itself, which is content and lives in `cv.md`, and
the names of the services on the contact page.

## Accessibility

The target is WCAG 2.2 AA. `tests/e2e/common/a11y.spec.ts` runs axe on every
page and with each dialog open, in both themes, and fails on a violation — so a
new page is scanned without being listed. What axe cannot judge is worth a look
by hand when a page changes:

- **Names.** A picture beside the text that names the same thing takes
  `alt=""`, or its description is read out as part of the name (the CV's cards).
  A link that opens a new tab says so in a `.visually-hidden` span.
- **Focus.** Every control shows keyboard focus with more than a faint fill. A
  client-side navigation moves focus to the new page's `<main>`.
- **Landmarks.** Two `<nav>`s on one page each get an `aria-label`.
- **Language.** A passage in another language is wrapped in `<span lang="…">`,
  in `cv.md` too; names of institutions are left as they are.

## URLs

Flat files decide them: `contact.html` is served at `/contact`, and both
`/contact/` and `/contact.html` 308 to it. There is no trailing slash and no
`.html`. An unknown address gets `404.html` with a 404.

`/cv` is kept out of search engines by its own `<meta name="robots">`.

Files Vite names by a hash of their content are written to `/_build/` and
cached for good (`public/_headers`); the pages and `public/assets`, whose names
never change, are asked for again on every visit.

That is also why `make preview` — and the tests — do not use a plain static
server, which 404s on every URL the site links to. `scripts/preview.ts` serves
`dist/client` by Pages' rules: the ones above, and `_headers`. It is this
repo's own reading of them, because Cloudflare's local server
(`wrangler pages dev`) needs Node — under Bun it never answers. So that the two
cannot drift apart unnoticed, CI asks each PR's real preview on Pages the same
questions (`scripts/check-pages.ts`).

## Which version is live

Every page carries `<meta name="commit" content="…">`: the commit it was built
from. View the source, or ask:

```bash
bun scripts/check-pages.ts https://www.insuit.cz            # says the commit
bun scripts/check-pages.ts https://www.insuit.cz <commit>   # fails unless it is that one
```

CI does the second after every deploy — a PR's preview and production alike —
and the PR comment names the commit its preview was built from.

## The CV

`content/cv/cv.md` is the source. `vite/cv.ts` turns it into the page's
data — served to the app as `virtual:cv` — on `make dev` (again on every edit)
and on `make build`: prose is rendered to HTML, every `####` is a project with
its pictures, video and links as data, and each link gets a QR code for print.
The pictures live in `public/assets/cv/`, each under 150 KB (`make images`).

A card or a gallery shows a picture about 240 px wide, so the build also writes
a 480 px WebP of every wider picture to `public/assets/cv-thumbs/` (not
committed), with Bun's own image reader — `Bun.Image`, no image library. The
full picture is fetched only when it is opened.

## Local

```bash
make           # list the targets
make install   # the dependencies (bun install)
make dev       # http://localhost:4321, hot reload
make preview   # the built site, served by Pages' rules, http://localhost:8788
make qa        # images, typecheck, oxfmt, oxlint, unit tests
make e2e       # Playwright against the built site; make e2e-head to watch it
make bdd       # Cucumber, likewise
make build     # dist/client — what gets deployed
```

`make dev` and `make build` take three values from the environment, all
optional locally:

- `CONTACT_EMAIL` — the address on /contact; a placeholder without it.
- `VITE_CF_BEACON_TOKEN` — Web Analytics; no beacon without it, so a local visit
  is never counted.
- `VITE_SITE_URL` — where the build will live, for the addresses its pages give
  for themselves (`og:url`, the link-preview picture). `https://www.insuit.cz`
  without it; CI sets it to the preview's address for a PR.

## Bootstrap (once)

1. `insuit.cz` must be a zone in the Cloudflare account (nameservers pointed at CF).
2. Create the R2 bucket that holds Terraform state:

   ```bash
   make bucket
   ```

3. Create an API token — My Profile → API Tokens — with:

   | Scope                | Permission                     | For                    |
   | -------------------- | ------------------------------ | ---------------------- |
   | Account              | Cloudflare Pages · Edit        | deploying the sites    |
   | Account              | Account Settings · Read + Edit | the Web Analytics site |
   | Zone: insuit.cz only | Zone Settings · Edit           | email obfuscation      |

   Tick **both** Read and Edit on Account Settings. Unlike most Cloudflare
   permissions, Edit does not include Read here: Edit alone creates the site but
   every later refresh of it fails with a 403, and Read alone can't create it
   (cloudflare/terraform-provider-cloudflare#3234). The zone scope covers
   settings only — Terraform doesn't manage DNS here (see the cutover section).

4. Create an R2 token scoped to **Object Read & Write on `insuit-cz-tf-state`
   only** — R2 → Manage API tokens.

GitHub repo **secrets**:

- `INSUIT_CZ_CF_API_TOKEN` — Cloudflare API token
- `INSUIT_CZ_R2_ACCESS_KEY_ID` — R2 token, scoped to this bucket
- `INSUIT_CZ_R2_SECRET_ACCESS_KEY` — R2 token secret

GitHub repo **variables**:

- `INSUIT_CZ_CF_ACCOUNT_ID` — Cloudflare account ID (same account as pollos)
- `INSUIT_CZ_CF_ZONE_ID` — insuit.cz zone ID (the zone's Overview page)
- `INSUIT_CONTACT_EMAIL` — the address on /contact, filled in at deploy so it
  isn't in the repo

State lives in its own bucket with its own token rather than sharing pollos's,
so neither project's credentials reach the other's state.

## CI/CD

Push to `main` touching `insuit/**` → `.github/workflows/insuit-deploy.yml`:

1. `terraform apply` — creates the `insuit-cz`, `insuit-preview` and `insuit-links` Pages projects
   and the Web Analytics site, and keeps email obfuscation on. It manages
   nothing else in the zone.
2. `make build`, with the Web Analytics token from `terraform output` and the
   `INSUIT_CONTACT_EMAIL` variable in its environment. The address is the one
   thing left out of the prerendered HTML: it is in the bundle base64-encoded
   and shown once the page runs, so no deployed file has it as text.
3. `wrangler pages deploy insuit/dist/client`.

PRs run `.github/workflows/insuit-ci.yml` — `make qa`, the e2e and Cucumber
suites against the built site, and `terraform fmt`/`validate`. Each PR from a branch of this
repo is also uploaded to Pages under its branch name, and the preview's address
is posted on the PR: the project is fed by direct upload, so Cloudflare builds
no previews of its own. A preview is the build the tests ran against: its
pages name the preview's own address, link-preview card included, and it has no
analytics token and the placeholder contact address.

## DNS cutover (manual, deliberate)

`insuit.cz` is a live, hand-curated zone: Google Workspace MX, nine Tunnel
CNAMEs, a GitHub Pages CNAME, a proxied wildcard, and existing Redirect Rules.
Terraform never touches records it doesn't declare, so none of that is at risk —
but the apex and `www` need changing by hand, because two collisions make them
unsafe to automate:

- Both already hold **A + AAAA** records. A CNAME cannot coexist with A/AAAA on
  the same name, so a declared `cloudflare_dns_record` would fail the apply.
- Cloudflare allows **one ruleset per phase per zone**. Managing
  `http_request_dynamic_redirect` in Terraform would overwrite _every_ Redirect
  Rule in the zone, including the live `www.insuit.cz → github.com/landsman` one.

Today the domain serves: `insuit.cz` → 301 → `www.insuit.cz` → 301 →
`github.com/landsman`.

To point it at this site, in the Cloudflare dashboard:

1. **Redirect Rules** → delete (or disable) the `www.insuit.cz →
github.com/landsman` rule. Keep the apex→www rule; it's the direction this
   site's `og:url` already assumes.
2. **DNS** → delete the A and AAAA records on `www.insuit.cz`, and replace them
   with `CNAME www → insuit-cz.pages.dev`, proxied.
3. **Workers & Pages → insuit-cz → Custom domains** → add `www.insuit.cz`.
4. Leave the apex A/AAAA and the `*` wildcard alone — the apex→www rule fires at
   the edge before origin, so the apex never needs to reach `46.28.105.54`.

Verify with `curl -sI https://www.insuit.cz` before and after.

## link.insuit.cz (the printed CV's QR codes)

The printed CV shows each project link as a QR code. The code does not hold the
link itself but `https://link.insuit.cz/<code>`, which redirects to it — so a
link can change after the CV is printed, and every copy still works.

- **`links/_redirects` is kept by hand** — one `/<code> <target> 302` rule per
  link. It is the whole link.insuit.cz site, together with `links/404.html`.
  Two sections: readable profile links (`/github`, `/linkedin`, `/x`, …) to use
  anywhere, and the CV's QR codes.
- The build gives each project link in `cv.md` the code whose target is that
  link. A link with no rule stops the build and prints a rule to add, so a
  QR code never leads nowhere.
- To send a printed code elsewhere: change its target in `links/_redirects`
  and the link in `cv.md` to match. Never delete or reuse a printed code.
- `links/` is its own Pages project, `insuit-links` (Terraform), deployed by
  the same workflow. Its own project because Pages redirect rules match the path
  only: on `insuit-cz` they would fire on `www.insuit.cz/<code>` as well.
- Once, by hand, for the same reason as `www` above: **Workers & Pages →
  insuit-links → Custom domains** → add `link.insuit.cz`. It gets its own
  proxied CNAME, which takes precedence over the `*` wildcard.

Locally: `npx wrangler pages dev links --port 4322`, then
`curl -sI http://localhost:4322/<code>`. This is the one command here that
needs Node: Cloudflare's local server does not answer under Bun.

## Ports

None — not self-hosted. If it ever moves onto the Pi, `dist/client` goes into
`nginx:alpine` with `try_files $uri $uri.html` and `404.html` as the error page;
claim a port in [`.docs/PORTS.md`](../.docs/PORTS.md) then.

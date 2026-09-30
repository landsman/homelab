# insuit.cz

Personal site — a home page, a contact page and the CV. React + TypeScript on
TanStack Start with file-based routes, the testing and tooling of
[`dashboard/`](../dashboard), and plain CSS, no Tailwind. **Every page is
rendered to an HTML file at build time**, so its text is in the page source;
React then takes the page over in the browser. Hosted on Cloudflare Pages.

```
src/
  routes/             one file per page — TanStack Router, file-based
  routes/__root.tsx   the document around every page: <head>, footer
  routeTree.gen.ts    generated from routes/ by the Vite plugin, never edited
  router.tsx          the router; server.ts is the build-time renderer's entry
  app/                what every page shares: footer, theme toggle, ROUTES, page-meta
  features/<page>/    a page's own components and data
  features/cv/cv.md   the CV's source — edit this, not the components
  index.css           stylesheet entry point, @imports only
  styles/             tokens, fonts, reset, page, typography, components/
  paraglide/          the compiled messages — generated, not committed
messages/en.json      every word of the interface, by key
project.inlang/       the locales, for Paraglide
vite/cv.ts            builds the CV page's data and QR codes from cv.md
public/               copied to the site as is
  assets/fonts/       self-hosted Fira Mono (SIL OFL)
  assets/icons/       masked glyphs + favicon
  assets/cv/          the CV's pictures
tests/                vitest (cv/, i18n/), Playwright (e2e/), Cucumber (bdd/)
links/                link.insuit.cz — see below
og/                   the Open Graph card's source
infra/                Terraform: the Pages projects only — see DNS cutover below
```

Every colour, size, spacing and duration lives in `src/styles/tokens.css` — the
other files only reference custom properties.

## Adding a page

1. `src/routes/<name>.tsx` with `createFileRoute("/<name>")` — the route tree
   regenerates while `make dev` runs. Its `head` takes `pageMeta({ title,
description, path })` for the title and the link-preview tags. Parameters and
   loaders for a dynamic page go in the same file.
2. The page itself in `src/features/<name>/`, rendering its own
   `<main className="wrapper">`.
3. Its path in `ROUTES` (`src/app/routes.ts`); link to it with `<Link>`. The
   build finds a page by following links from `/`; one that nothing links to is
   added to `pages` in `vite.config.ts`.
4. Its words in `messages/en.json` (below), an e2e spec and a Cucumber scenario.

Inside `src/`, import through the `@/` alias (`@/app/routes`), never a relative
path — oxlint rejects `./` and `../` there.

A page is rendered twice: at build time, where there is no `window`, and in the
browser. Anything that needs the browser — `document`, `localStorage`,
`matchMedia` — goes in an effect or an event handler, and the first render has
to come out the same in both places. `make e2e` fails on a page where it does
not: on the built site for elements and text, and on the dev server
(`tests/e2e/dev/`) for attributes, which only React's development build
reports.

## Localisation

Every word of the interface is a key in `messages/en.json`, used through
Paraglide: `m.home_heading()`, `m.cv_video_play({ title })`. A missing key is a
type error. Keys are `<area>_<thing>` — `common_`, `home_`, `contact_`, `cv_`,
`not_found_` — and name the thing, not where it sits.

English is the only locale. A second one is one entry in
`project.inlang/settings.json` plus `messages/<locale>.json`; `make test` fails
until it has every key. How a visitor gets that language — a URL prefix, a
cookie — is the `strategy` in `vite.config.ts`, `baseLocale` until then.

Not in the catalogue: the CV itself, which is content and lives in `cv.md`, and
the names of the services on the contact page.

## URLs

Flat files decide them: `contact.html` is served at `/contact`, and both
`/contact/` and `/contact.html` 308 to it. There is no trailing slash and no
`.html`. An unknown address gets `404.html` with a 404.

`/cv` is kept out of search engines by its own `<meta name="robots">`.

That is also why `make preview` — and the tests — run Cloudflare's own asset
server instead of a plain static one: a dumb file server 404s on every URL the
site links to.

## The CV

`src/features/cv/cv.md` is the source. `vite/cv.ts` turns it into the page's
data — served to the app as `virtual:cv` — on `make dev` (again on every edit)
and on `make build`: prose is rendered to HTML, every `####` is a project with
its pictures, video and links as data, and each link gets a QR code for print.
The pictures live in `public/assets/cv/`, each under 150 KB (`make images`).

## Local

```bash
make           # list the targets
make install   # npm deps
make dev       # http://localhost:4321, hot reload
make preview   # the built site, served the way Pages does, http://localhost:8788
make qa        # images, typecheck, oxfmt, oxlint, unit tests
make e2e       # Playwright against the built site; make e2e-head to watch it
make bdd       # Cucumber, likewise
make build     # dist/client — what gets deployed
```

`make dev` and `make build` take two values from the environment, both optional
locally: `CONTACT_EMAIL` (the address on /contact; a placeholder without it) and
`VITE_CF_BEACON_TOKEN` (Web Analytics; no beacon without it, so a local visit is
never counted).

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

1. `terraform apply` — creates the `insuit-cz` and `insuit-links` Pages projects
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
no previews of its own. A preview is the build the tests ran against: no
analytics token, no OG card, and the placeholder contact address.

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
`curl -sI http://localhost:4322/<code>`.

## Ports

None — not self-hosted. If it ever moves onto the Pi, `dist/client` goes into
`nginx:alpine` with `try_files $uri $uri.html` and `404.html` as the error page;
claim a port in [`.docs/PORTS.md`](../.docs/PORTS.md) then.

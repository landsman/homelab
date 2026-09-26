# insuit.cz

Personal site — a home page and a contact page. Plain HTML + `style.css`, no
build step. Hosted on Cloudflare Pages.

```
site/                 the pages — this directory IS the deploy artifact
  index.html          home; everything else is under assets/
  contact.html        where to find me — served at `/contact`, see URLs below
  assets/style.css    stylesheet entry point, @imports only
  assets/css/         tokens, fonts, reset, page, typography
  assets/css/components/  links, icons, theme toggle
  assets/js/          theme override, animated favicon (plain JS + JSDoc)
  assets/fonts/       self-hosted Fira Mono (SIL OFL)
  assets/icons/       masked glyphs + favicon
infra/                Terraform: the Pages project only — see DNS cutover below
```

Every colour, size, spacing and duration lives in `assets/css/tokens.css` — the
other files only reference custom properties.

## URLs

There is no trailing slash and no `.html`, and that isn't configuration — on
Pages the file layout decides it. A flat `contact.html` is canonical at
`/contact`; both `/contact/` and `/contact.html` 308 to it. Naming the file
`contact/index.html` inverts the whole thing: `/contact/` becomes canonical and
the bare `/contact` redirects to it. So link to `/contact`, and keep new pages
flat.

That is also why `make dev` runs Cloudflare's own asset server instead of a
plain static one — a dumb file server 404s on every URL the site links to.

## Local

```bash
make           # list the targets
make install   # oxfmt
make dev       # http://localhost:4321
make format    # oxfmt (the Vite+ formatter — handles HTML and CSS)
make qa        # check formatting without writing — what CI runs
```

## Bootstrap (once)

1. `insuit.cz` must be a zone in the Cloudflare account (nameservers pointed at CF).
2. Create the R2 bucket that holds Terraform state:

   ```bash
   make bucket
   ```

3. Create an API token — My Profile → API Tokens — with:

   | Scope                | Permission                  | For                    |
   | -------------------- | --------------------------- | ---------------------- |
   | Account              | Cloudflare Pages · Edit     | deploying the sites    |
   | Account              | Account Settings · Edit     | the Web Analytics site |
   | Zone: insuit.cz only | Zone Settings · Edit        | email obfuscation      |

   Account Settings has to stay at Edit. It is the only permission the Web
   Analytics API accepts, and although the API docs say Read is enough to read a
   site back, every apply then fails with a 403. Zone Settings stays at Edit
   too, for the same reason until proven otherwise; it is scoped to insuit.cz
   and covers settings only — Terraform doesn't manage DNS here (see the
   cutover section).

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
2. The Web Analytics token from `terraform output` and the
   `INSUIT_CONTACT_EMAIL` variable replace the `__CF_BEACON_TOKEN__` and
   `__CONTACT_EMAIL__` placeholders in `site/*.html`.
3. `wrangler pages deploy insuit/site`.

PRs run `.github/workflows/insuit-ci.yml` — oxfmt check + `terraform fmt`/`validate`.

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
- `make cv` gives each project link in `site/cv.md` the code whose target is
  that link. A link with no rule stops the build and prints a rule to add, so a
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

None — not self-hosted. If it ever moves onto the Pi, `site/` drops straight into
`nginx:alpine` with no source changes; claim a port in [`.docs/PORTS.md`](../.docs/PORTS.md) then.

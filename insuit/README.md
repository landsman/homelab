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
infra/                Terraform: Pages project + zone identity DNS (MX, TXT)
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

3. Create an API token — My Profile → API Tokens — scopes:
   `Account · Cloudflare Pages · Edit` and `Zone · DNS · Edit` on `insuit.cz`
   (Terraform owns the MX and verification TXT records, see below).
4. Create an R2 token scoped to **Object Read & Write on `insuit-cz-tf-state`
   only** — R2 → Manage API tokens.

GitHub repo **secrets**:

- `INSUIT_CZ_CF_API_TOKEN` — Cloudflare API token
- `INSUIT_CZ_R2_ACCESS_KEY_ID` — R2 token, scoped to this bucket
- `INSUIT_CZ_R2_SECRET_ACCESS_KEY` — R2 token secret

GitHub repo **variables**:

- `INSUIT_CZ_CF_ACCOUNT_ID` — Cloudflare account ID (same account as pollos)
- `INSUIT_CZ_CF_ZONE_ID` — zone ID of `insuit.cz`

State lives in its own bucket with its own token rather than sharing pollos's,
so neither project's credentials reach the other's state.

## CI/CD

Push to `main` touching `insuit/**` → `.github/workflows/insuit-deploy.yml`:

1. `terraform apply` — creates the `insuit-cz` Pages project. It manages nothing
   else in the zone.
2. `wrangler pages deploy insuit/site`.

PRs run `.github/workflows/insuit-ci.yml` — oxfmt check + `terraform fmt`/`validate`.

## DNS in code

`infra/dns.tf` declares the records nothing else recreates — the seven Google
Workspace MX records and the two verification TXT records. The Tunnel CNAMEs
(cloudflared owns them), the Pages and GitHub Pages CNAMEs and the apex/wildcard
A + AAAA stay unmanaged; Terraform never touches records it doesn't declare.

A full BIND export of the zone does **not** belong in this repo — it's public,
and the export leaks what the Cloudflare proxy exists to hide: the origin IP,
the Tunnel UUIDs and the tailnet name. Export from the dashboard when you need
a snapshot, keep it out of git.

These records already exist, so **import them once** before the first apply,
otherwise Terraform creates duplicates:

```bash
cd insuit/infra
ZONE=<zone id>; TOKEN=<api token>
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?per_page=100" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.result[] | select(.type=="MX" or .type=="TXT") | "\(.type) \(.content) \(.id)"'

terraform import 'cloudflare_dns_record.mx["aspmx.l.google.com"]' "$ZONE/<id>"
# ... once per MX host, then:
terraform import cloudflare_dns_record.google_site_verification "$ZONE/<id>"
terraform import cloudflare_dns_record.github_pages_challenge   "$ZONE/<id>"
terraform plan   # must be clean before letting CI apply
```

No SPF or DMARC record exists on the zone today. Worth adding
(`v=spf1 include:_spf.google.com ~all` + a `_dmarc` TXT) — not done here because
mail policy changes shouldn't ride along with a backup commit.

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
   the edge before origin, so the apex never needs to reach the origin at all.

Verify with `curl -sI https://www.insuit.cz` before and after.

## Ports

None — not self-hosted. If it ever moves onto the Pi, `site/` drops straight into
`nginx:alpine` with no source changes; claim a port in [`.docs/PORTS.md`](../.docs/PORTS.md) then.

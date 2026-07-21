# insuit.cz

Personal one-page site. Plain `index.html` + `style.css` — no build step, no JS.
Hosted on Cloudflare Pages.

```
site/     the page — this directory IS the deploy artifact
infra/    Terraform: Pages project, custom domains, DNS, www→apex redirect
```

## Local

```bash
make install   # oxfmt
make dev       # http://localhost:4321
make format    # oxfmt (the Vite+ formatter — handles HTML and CSS)
```

## Bootstrap (once)

1. `insuit.cz` must be a zone in the Cloudflare account (nameservers pointed at CF).
2. Create an API token — My Profile → API Tokens — scopes:
   `Account · Cloudflare Pages · Edit`, `Zone · DNS · Edit` (zone `insuit.cz`).

GitHub repo **secret**:

- `INSUIT_CZ_CF_API_TOKEN`

GitHub repo **variables**:

- `INSUIT_CZ_CF_ACCOUNT_ID` — Cloudflare account ID (same account as pollos)
- `INSUIT_CZ_CF_ZONE_ID` — `insuit.cz` zone ID

Terraform state shares the existing `pollos-cz-tf-state` R2 bucket under key
`insuit-cz.tfstate`, so the deploy reuses `POLLOS_CZ_R2_ACCESS_KEY_ID` /
`POLLOS_CZ_R2_SECRET_ACCESS_KEY`. No extra bucket to create.

## CI/CD

Push to `main` touching `insuit/**` → `.github/workflows/insuit-deploy.yml`:

1. `terraform apply` — Pages project, `insuit.cz` + `www.insuit.cz` domains, DNS,
   301 www→apex.
2. `wrangler pages deploy insuit/site`.

PRs run `.github/workflows/insuit-ci.yml` — oxfmt check + `terraform fmt`/`validate`.

## Ports

None — not self-hosted. If it ever moves onto the Pi, `site/` drops straight into
`nginx:alpine` with no source changes; claim a port in [`.docs/PORTS.md`](../.docs/PORTS.md) then.

# pollos.cz

Static single-page microsite hosted on Cloudflare Pages.

## 1. Init (once)

Create the R2 bucket that holds Terraform state, and add GitHub secrets.

> **Activate R2 first** in the Cloudflare dashboard → R2 → "Enable R2". Requires a payment method on file (R2 has a free tier — 10 GB storage, 1M Class A + 10M Class B ops/month — but card is mandatory to unlock the API). Bucket creation will 403 until this is done.

```bash
make bootstrap   # mise install + wrangler + login + create R2 bucket
```

Bucket name `pollos-cz-tf-state` (also in `infra/main.tf` backend). Targets: `make install`, `make login`, `make bucket`. Terraform never runs locally — all `plan`/`apply` happens in CI with secrets from GitHub.

Requires `mise` and `gpg` installed. macOS: `brew install mise gnupg`. Ubuntu: see [mise.jdx.dev](https://mise.jdx.dev/getting-started.html) + `apt install gnupg`.

GitHub repo **secrets** (sensitive):

- `POLLOS_CZ_CF_API_TOKEN` — Cloudflare API token, scopes: `Account · Cloudflare Pages · Edit`, `Zone · DNS · Edit` (zone `pollos.cz`)
- `POLLOS_CZ_R2_ACCESS_KEY_ID` — R2 token (Object R/W on `pollos-cz-tf-state` bucket)
- `POLLOS_CZ_R2_SECRET_ACCESS_KEY` — R2 token secret

GitHub repo **variables** (not sensitive — just identifiers):

- `POLLOS_CZ_CF_ACCOUNT_ID` — Cloudflare account ID
- `POLLOS_CZ_CF_ZONE_ID` — `pollos.cz` zone ID

## 2. CI/CD

Push to `main` touching `pollos/**` →
`.github/workflows/pollos-deploy.yml` runs:

1. `terraform apply` — Pages project, custom domains, DNS, apex→www redirect (state in R2).
2. `wrangler pages deploy` — uploads everything under `public/`.

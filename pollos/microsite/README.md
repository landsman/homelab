# pollos.cz

Static single-page microsite hosted on Cloudflare Pages.

## 1. Init (once)

Create the R2 bucket that holds Terraform state, and add GitHub secrets.

> **Activate R2 first** in the Cloudflare dashboard → R2 → "Enable R2". Requires a payment method on file (R2 has a free tier — 10 GB storage, 1M Class A + 10M Class B ops/month — but card is mandatory to unlock the API). Bucket creation will 403 until this is done.

```bash
make bootstrap   # mise install + wrangler + login + create R2 bucket
```

Bucket name `pollos-cz-tf-state` (also in `../infra/main.tf` backend; Terraform lives in [`pollos/infra`](../infra) and covers the site **and** node monitoring). Targets: `make install`, `make login`, `make bucket`. Terraform never runs locally — all `plan`/`apply` happens in CI with secrets from GitHub.

Requires `mise` and `gpg` installed. macOS: `brew install mise gnupg`. Ubuntu: see [mise.jdx.dev](https://mise.jdx.dev/getting-started.html) + `apt install gnupg`.

Deploys run under the **`pollos`** GitHub environment, not repo-level secrets.
Every credential the workflow needs — what it is, where to get it, which scopes —
is listed once in [`../infra/README.md`](../infra/README.md#credentials).

## 2. CI/CD

Push to `main` touching `pollos/**` →
`.github/workflows/pollos-deploy.yml` runs, in this order:

1. `terraform apply` (`infra` job) — Pages project, custom domains (incl. `microsite-ws.pollos.cz`), DNS, apex→www redirect, plus per-node health tunnels + BetterStack monitors (state in R2).
2. `wrangler pages deploy` (`content` job) — uploads everything under `public/`.
3. `wrangler deploy` (`worker` job) — ships the [`microsite-ws`](../microsite-ws) Worker. Last, because infra owns its custom domain.

Terraform, its runbooks and the credential list live in [`pollos/infra`](../infra/README.md); the box-side connector install is [`pollos/setup/003-monitoring.sh`](../setup/003-monitoring.sh).

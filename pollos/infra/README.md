# infra

Terraform for everything around [pollos](../README.md) that isn't the site
itself: Cloudflare DNS and Pages domains, the Worker's custom domain, per-node
health tunnels, BetterStack monitors and status page, and the Tailscale tailnet
policy.

| File                      | Manages                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `main.tf`                 | providers, R2 state backend, Pages project + apex/www DNS and redirect  |
| `monitoring.tf`           | health tunnels per node, BetterStack monitors, `health_tunnel_tokens`   |
| `status_page.tf`          | status.pollos.cz page, sections, resources                              |
| `maintenance-schedule.tf` | status-page maintenance windows (via the generic REST provider)         |
| `microsite-ws.tf`         | custom domain for the realtime [Worker](../microsite-ws/README.md)      |
| `tailscale.tf`            | tailnet ACL, `tag:pollos` enrollment key, `tailscale_authkey`           |

## Apply

**There is no local apply.** `.github/workflows/pollos-deploy.yml` runs
`terraform apply -auto-approve` on push to `main` — merging is the deploy.
Locally you only check:

```sh
make ci     # fmt -check + init -backend=false + validate — no credentials needed
make fmt    # format in place
```

## Credentials

The deploy jobs run under the **`pollos`** GitHub environment. A job can
reference exactly one environment, so everything the workflow reads must live
there. A secret in the wrong environment resolves to an **empty string** instead
of failing, which surfaces later as a confusing 401 or a malformed URL.

| Name                                   | Kind   | Where to get it                                                                     |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `POLLOS_CZ_CF_API_TOKEN`               | secret | Cloudflare → My Profile → API Tokens. Scopes: `Account · Cloudflare Pages · Edit`, `Account · Workers Scripts · Edit`, `Account · Cloudflare Tunnel · Edit` (listed as **Argo Tunnel (Legacy)**), `Zone · DNS · Edit` on `pollos.cz` |
| `POLLOS_CZ_R2_ACCESS_KEY_ID`           | secret | Cloudflare → R2 → API → Manage API tokens. Object Read/Write on `pollos-cz-tf-state` |
| `POLLOS_CZ_R2_SECRET_ACCESS_KEY`       | secret | same token, shown once at creation                                                  |
| `POLLOS_BETTERUPTIME_API_TOKEN`        | secret | BetterStack → Settings → API tokens                                                 |
| `POLLOS_TAILSCALE_OAUTH_CLIENT_ID`     | secret | Tailscale → [Trust credentials](https://login.tailscale.com/admin/settings/trust-credentials) → Credential → OAuth (see below) |
| `POLLOS_TAILSCALE_OAUTH_CLIENT_SECRET` | secret | same credential, shown once at creation                                             |
| `POLLOS_CZ_CF_ACCOUNT_ID`              | var    | Cloudflare account ID — dashboard URL, or Workers & Pages → Account details          |
| `POLLOS_CZ_CF_ZONE_ID`                 | var    | `pollos.cz` zone → Overview → API section                                           |

Adding one — `gh` prompts for the value so it never lands in shell history:

```sh
gh secret set POLLOS_CZ_CF_API_TOKEN --repo landsman/homelab --env pollos
gh variable set POLLOS_CZ_CF_ZONE_ID --repo landsman/homelab --env pollos
```

GitHub never returns a secret's value, not even to an admin. Rotating or moving
one always means re-entering it from 1Password.

### Tailscale OAuth client

[Trust credentials](https://login.tailscale.com/admin/settings/trust-credentials)
→ **Credential** → **OAuth**, scopes **Policy File → Write** and **Auth Keys →
Write**, tagged `tag:terraform`. (Tailscale replaced the old *OAuth clients*
page with this one.)

Chicken-and-egg on first setup: the client can't be tagged `tag:terraform` until
that tag exists in the policy, and Terraform is what writes the policy. So
declare it by hand once in
[Access controls](https://login.tailscale.com/admin/acls/file) before creating
the client:

```json
"tagOwners": {
    "tag:terraform": ["autogroup:admin"],
    "tag:pollos":    ["autogroup:admin", "tag:terraform"],
},
```

The first apply then overwrites the policy with the identical `tagOwners` from
`tailscale.tf`. Note that `tailscale_acl` owns the **whole** policy file
(`overwrite_existing_content`), so anything clicked into the admin console is
discarded on the next apply. Exit node approvals live per-device under Machines,
not in the policy, so those survive.

## Reading state

Both runbooks below read a value Terraform minted, which means initialising the
R2 backend for real. Create `backend.hcl` here once — it's gitignored:

```hcl
endpoints  = { s3 = "https://<POLLOS_CZ_CF_ACCOUNT_ID>.r2.cloudflarestorage.com" }
access_key = "<POLLOS_CZ_R2_ACCESS_KEY_ID>"
secret_key = "<POLLOS_CZ_R2_SECRET_ACCESS_KEY>"
```

Then `make authkey` and `make tunnel-tokens` do the rest. Both print a secret on
stdout and nothing else, so they compose:

```sh
TS_AUTHKEY=$(make -s authkey)     # or: make -s authkey | pbcopy
```

**Don't copy these out of the terminal by eye.** Terraform prints raw output
without a trailing newline, so zsh marks the line end with an inverse `%` —
select the key and you select the `%` with it, and Tailscale rejects it as
`invalid key: unable to validate API key`, which reads like a broken key rather
than a copy-paste artifact. Command substitution and `pbcopy` both avoid it.

This is a `-backend-config` file rather than `.tfvars` on purpose: Terraform
resolves the backend **before** variables exist, so a `backend` block can't
reference `var.*`. A partial backend config is the only native way to keep the
account id and R2 secret out of a public repo. CI passes the same values inline
from the `pollos` environment and never reads this file.

Outputs are marked `sensitive`, which keeps them out of plan/apply logs but
**not** out of the state file. Anyone with the R2 credentials can read every
secret in there.

### Enroll a box on Tailscale

Puts a box on the tailnet as a plain node, reachable by MagicDNS name from
anywhere. Script: [`../setup/005-tailscale.sh`](../setup/005-tailscale.sh).

```sh
TS_AUTHKEY=$(make -s authkey)

# on the box (gus/mike/walter/jesse), as root:
TS_AUTHKEY="$TS_AUTHKEY" wget -qO- https://pollos.cz/tailscale.sh | sh
```

The key is reusable and pre-authorized, so one key enrolls every box. It expires
after 90 days (Tailscale's maximum) and the next apply mints a replacement.

### Connect a box to its health tunnel

Gives a box the connector token for its own tunnel and nothing else. Script:
[`../setup/003-monitoring.sh`](../setup/003-monitoring.sh).

```sh
make tunnel-tokens    # one token per node

# on the box, as root:
sudo TUNNEL_TOKEN=eyJhIjoi... sh monitoring.sh
```

## Adding a node

1. Add the hostname to `local.monitor_nodes` in `monitoring.tf` — one list drives
   the health tunnel, DNS record, BetterStack monitor and status-page entry.
2. Merge to `main` and let the workflow apply.
3. Run both runbooks above on the new box, plus the rest of
   [`../setup`](../setup).

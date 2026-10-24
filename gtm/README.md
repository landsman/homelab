# GTM as code

A reusable workflow, [`.github/workflows/gtm.yml`](../.github/workflows/gtm.yml), that keeps a site's Google Tag Manager container and GA4 property in sync with an `analytics.yaml` in its repo, through [gtm-as-code](https://github.com/StackMade/gtm-as-code).

- `plan`, on a pull request: comments what would change. The comment names resources by their keys in the config, never by Google ids.
- `deploy`, on `main`: applies and publishes, only when the plan has anything to do. `apply` alone only stages a draft in the workspace.

Used by [insuit.cz](../insuit). Any other repo can call it, since this one is public.

## What a site needs

- `@stackmade/gtm-as-code` in its devDependencies, and a `bun.lock`.
- `analytics.yaml` in its folder, its ids written as `${GTM_ACCOUNT_ID}`, `${GTM_CONTAINER_ID}` and `${GA4_PROPERTY_ID}`.
- `.analytics/state.json` committed once it exists. It is the only record of which GA4 resources are ours. When a deploy changes it, the job fails and keeps the new file as the `gtm-state` artifact: commit that, or the next run creates the same resources again.

## Calling it

```yaml
  gtm:
    uses: landsman/homelab/.github/workflows/gtm.yml@<sha>
    permissions: { contents: read, id-token: write, pull-requests: write }
    with:
      command: plan                # deploy, with environment: production
      working-directory: site      # where package.json and analytics.yaml are
      gtm-account-id: ${{ vars.GTM_ACCOUNT_ID }}
      gtm-container-id: ${{ vars.GTM_CONTAINER_ID }}
      ga4-property-id: ${{ vars.GA4_PROPERTY_ID }}
    secrets:
      workload-identity-provider: ${{ secrets.GCP_GTM_WIF_PROVIDER }}
      service-account: ${{ secrets.GCP_GTM_PLAN_SA_EMAIL }}   # GCP_GTM_SA_EMAIL for deploy
```

- **Pin a commit**, not `@main`: a change here then cannot change what runs with another site's credentials.
- **Pass ids and secrets explicitly.** The caller's `env:` does not reach a called workflow, and `secrets: inherit` would hand it every secret in the repo.
- **It skips** while any of the three ids is empty, so a repo can carry the jobs before the accounts exist.
- **Run it only when the config changes**, as insuit does with a `changes` job ([`insuit-ci.yml`](../.github/workflows/insuit-ci.yml)): the config, `.analytics/`, `package.json` (the gtm-code version) and this workflow. An edit made in the GTM UI then stays until the config next changes.

## Accounts

Workload Identity Federation, no keys. Two service accounts, because a pull request can change what its job runs:

| Secret | GTM | GA4 | Used by |
|---|---|---|---|
| `GCP_GTM_PLAN_SA_EMAIL` | Read | Viewer | `plan`, on every PR |
| `GCP_GTM_SA_EMAIL` | Publish | Editor | `deploy`, bound in the WIF provider to `environment:production` only |

Set them, and the three ids as variables, at repo level: the PR job has no environment. The OIDC token names the calling repo, so the WIF provider has to allow each repo that calls this.

# GTM as code

A composite action, [`action.yml`](action.yml), that keeps a site's Google Tag Manager container and GA4 property in sync with an `analytics.yaml` in its repo, through [gtm-as-code](https://github.com/StackMade/gtm-as-code).

- `plan`, on a pull request: comments what would change. The comment names resources by their keys in the config, never by Google ids.
- `deploy`, on `main`: applies and publishes, only when the plan has anything to do. `apply` alone only stages a draft in the workspace.

Run it only when its config changes, with the shared [changes action](../changes/action.yml) and a feature in the repo's spec. Used by [insuit.cz](../../../insuit). Any other repo can call both, since this one is public.

## What a site needs

- `@stackmade/gtm-as-code` in its devDependencies, and a `bun.lock`.
- `analytics.yaml` in its folder, its ids written as `${GTM_ACCOUNT_ID}`, `${GTM_CONTAINER_ID}` and `${GA4_PROPERTY_ID}`.
- `.analytics/state.json` committed once it exists. It is the only record of which GA4 resources are ours. When a deploy changes it, the job fails and keeps the new file as the `gtm-state` artifact: commit that, or the next run creates the same resources again.

## Calling it

A feature in the repo's `.github/changes.yml` (homelab's own: [`changes.yml`](../../changes.yml)):

```yaml
site-gtm:
  - { value: config, paths: ['site/analytics.yaml'] }
  - { value: state, paths: ['site/.analytics/**'] }
  - { value: toolchain, paths: ['site/package.json'] }   # the gtm-code version
```

And the jobs:

```yaml
  changes:
    runs-on: ubuntu-latest
    outputs:
      gtm: ${{ fromJSON(steps.changes.outputs.changes)['site-gtm'] }}
    steps:
      - uses: actions/checkout@v7       # the spec is read from it
      - id: changes
        uses: landsman/homelab/.github/actions/changes@<sha>

  gtm:
    needs: [changes]
    if: needs.changes.outputs.gtm != 'none' && vars.GTM_ACCOUNT_ID != ''
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write, pull-requests: write }
    # deploy: environment: production, and a concurrency group, since
    # gtm-code's lock is a file on the runner
    steps:
      - uses: actions/checkout@v7
      - uses: landsman/homelab/.github/actions/gtm@<sha>
        with:
          command: plan                # or deploy
          working-directory: site
          gtm-account-id: ${{ vars.GTM_ACCOUNT_ID }}
          gtm-container-id: ${{ vars.GTM_CONTAINER_ID }}
          ga4-property-id: ${{ vars.GA4_PROPERTY_ID }}
          workload-identity-provider: ${{ secrets.GCP_GTM_WIF_PROVIDER }}
          service-account: ${{ secrets.GCP_GTM_PLAN_SA_EMAIL }}   # GCP_GTM_SA_EMAIL for deploy
```

- **Pin a commit**, not `@main`: a change here then cannot change what runs with another site's credentials.
- **The feature** is `none` when nothing it lists changed, and `all` on a hand-started run. An edit made in the GTM UI stays until the config next changes.
- **Check the ids in `if:`**, so a repo can carry the jobs before the accounts exist.

## Accounts

Workload Identity Federation, no keys. Two service accounts, because a pull request can change what its job runs:

| Secret | GTM | GA4 | Used by |
|---|---|---|---|
| `GCP_GTM_PLAN_SA_EMAIL` | Read | Viewer | `plan`, on every PR |
| `GCP_GTM_SA_EMAIL` | Publish | Editor | `deploy`, bound in the WIF provider to `environment:production` only |

Set them, and the three ids as variables, at repo level: the PR job has no environment. The OIDC token names the calling repo, so the WIF provider has to allow each repo that calls this.

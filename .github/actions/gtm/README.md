# GTM as code

A composite action, [`action.yml`](action.yml), that keeps a site's Google Tag Manager container and GA4 property in sync with an `analytics.yaml` in its repo, through [gtm-as-code](https://github.com/StackMade/gtm-as-code).

- `plan`, on a pull request: comments what would change. The comment names resources by their keys in the config, never by Google ids.
- `deploy`, on `main`: applies and publishes, only when the plan has anything to do. `apply` alone only stages a draft in the workspace.

Run it only when its config changes, with the shared [changes action](../changes/action.yml) and a feature in the repo's spec. Used by [insuit.cz](../../../insuit). Any other repo can call both, since this one is public.

## What a site needs

- `@stackmade/gtm-as-code` in its devDependencies, and a `bun.lock`.
- `analytics.yaml` in its folder, with its ids written in: step 1 of the setup below says where each is. One read as `${VAR}` instead comes from the job's `env:`.
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
    if: needs.changes.outputs.gtm != 'none'
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
          workload-identity-provider: ${{ secrets.GCP_GTM_WIF_PROVIDER }}
          service-account: ${{ secrets.GCP_GTM_PLAN_SA_EMAIL }}   # GCP_GTM_SA_EMAIL for deploy
```

- **Pin a commit**, not `@main`: a change here then cannot change what runs with another site's credentials.
- **The feature** is `none` when nothing it lists changed, and `all` on a hand-started run. An edit made in the GTM UI stays until the config next changes.

## Accounts

Workload Identity Federation, no keys. Two service accounts, because a pull request can change what its job runs:

| Secret | GTM | GA4 | Used by |
|---|---|---|---|
| `GCP_GTM_PLAN_SA_EMAIL` | Read | Viewer | `plan`, on every PR |
| `GCP_GTM_SA_EMAIL` | Publish | Editor | `deploy`, bound in the WIF provider to `environment:production` only |

Set them at repo level: the PR job has no environment. The OIDC token names the calling repo, so the WIF provider has to allow each repo that calls this.

## Setting it up, once

`<project>` is a Google Cloud project, `<number>` its project number (`gcloud projects describe <project> --format='value(projectNumber)'`), `<owner>/<repo>` the repo that calls this.

1. Write the site's ids into its `analytics.yaml`, quoted, as `google.gtm.accountId`, `google.gtm.containerId`, `google.ga4.propertyId` and `google.ga4.measurementId`. None is secret.
   - GTM account and container: the container's URL, `tagmanager.google.com/#/container/accounts/<accountId>/containers/<containerId>/…`.
   - GA4 property: any report's URL, `analytics.google.com/analytics/web/#/a<account>p<propertyId>/…`. The web stream's id is a different number.
   - GA4 measurement id (`G-…`): Admin → Data streams → the site's stream.
2. Enable the APIs: `gcloud services enable tagmanager.googleapis.com analyticsadmin.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project <project>`.
3. Create the pool: `gcloud iam workload-identity-pools create github --location global --project <project>`.
4. Create its GitHub provider, open to your repos only:
   ```sh
   gcloud iam workload-identity-pools providers create-oidc github \
     --location global --workload-identity-pool github --project <project> \
     --issuer-uri https://token.actions.githubusercontent.com \
     --attribute-mapping google.subject=assertion.sub,attribute.repository=assertion.repository \
     --attribute-condition "assertion.repository_owner == '<owner>'"
   ```
5. Create the two accounts: `gcloud iam service-accounts create gtm-plan --project <project>`, and the same for `gtm-deploy`.
6. Let any job of the repo sign in as `gtm-plan`:
   ```sh
   gcloud iam service-accounts add-iam-policy-binding gtm-plan@<project>.iam.gserviceaccount.com --project <project> \
     --role roles/iam.workloadIdentityUser \
     --member 'principalSet://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/github/attribute.repository/<owner>/<repo>'
   ```
7. Let only its `production` jobs sign in as `gtm-deploy`: the same command for `gtm-deploy@…`, with the member `principal://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/github/subject/repo:<owner>/<repo>:environment:production`. That is the token's `sub` for a job with that environment, and no other job has it.
8. In GTM, Admin → User Management on the account: add `gtm-plan@…` with **Read** on the container, and `gtm-deploy@…` with **Publish**.
9. In GA4, Admin → Property access management: add `gtm-plan@…` as **Viewer**, `gtm-deploy@…` as **Editor**.
10. Set the secrets on the repo:
   ```sh
   gh secret set GCP_GTM_WIF_PROVIDER --body projects/<number>/locations/global/workloadIdentityPools/github/providers/github
   gh secret set GCP_GTM_PLAN_SA_EMAIL --body gtm-plan@<project>.iam.gserviceaccount.com
   gh secret set GCP_GTM_SA_EMAIL --body gtm-deploy@<project>.iam.gserviceaccount.com
   ```
11. Open a PR that touches `analytics.yaml`. Its plan comment says the sign-in and the read access work, and the first merge proves the deploy account.

For a second repo, step 1, then steps 6, 7 and 10 again with its `<owner>/<repo>`, and steps 8 and 9 for its own container and property.

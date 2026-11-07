# domains

The domains I own, as Terraform: each zone's DNS records, mail and redirect
rules. A website served on one of them is not here. Its Pages project and
everything around it stay with its code (`insuit/infra`, `pollos/infra`).

```
main.tf            backend, provider, one module block per zone
imports.tf         records adopted from the dashboard, deleted once applied
modules/
  redirect/        parked zone: every hostname 301s to one URL
  google-mail/     Google Workspace MX
zones/<name>-<tld>/  one zone, named so a name's TLDs sort together
```

A module gets written when a pattern repeats. A record that only one zone
has lives in that zone's folder.

## Adding a zone

1. `zones/<name>-<tld>/main.tf`: look the zone up by name and call the
   modules it needs. Copy `studioart-cz`.
2. A `module` block in `main.tf`.
3. Records that already exist in the dashboard get an `import` block in
   `imports.tf`. Without one the apply creates duplicates. Record ids come from
   `GET /zones/<id>/dns_records`, and the redirect ruleset from
   `GET /zones/<id>/rulesets`.
4. Add the zone to the API token's zone list (below).

`redirect` owns the zone's whole `http_request_dynamic_redirect` phase,
because Cloudflare allows one ruleset per phase. Check the dashboard for other
Redirect Rules before using it on a zone that has some.

## Setup

State sits in insuit's R2 bucket (`insuit-cz-tf-state`) under its own key, and
the deploy reads it with insuit's R2 token and account id. See
`insuit/README.md`.

The Cloudflare token is its own. Create it under My Profile → API Tokens:

| Permission              | For                       |
| ----------------------- | ------------------------- |
| Zone · Zone · Read      | finding a zone by name    |
| Zone · DNS · Edit       | the records               |
| Zone · Single Redirect · Edit | the redirect rules  |

Scope it to the managed zones only, and widen it when a zone is added.
Store it as the repo secret `DOMAINS_CF_API_TOKEN`.

## CI/CD

- A PR touching `domains/` runs `make ci` (format and validate) in
  `domains-ci.yml`.
- A push to `main` runs `terraform apply` in `domains-deploy.yml`.

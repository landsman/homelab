# Review instructions

This is a personal homelab monorepo: self-hosted service configs, small static
sites, Terraform for Cloudflare, and one React dashboard. Calibrate accordingly.

## What Important means here

Reserve 🔴 Important for things that break a running service or leak something:
a container that won't start, a wrong port or volume path, a credential or token
committed in plaintext, a Terraform change that destroys state or live DNS, a
migration that isn't reversible. Style, naming, and refactoring are Nit at most.

## Verification bar

Do not report that a version, API, resource type, or CLI flag "does not exist"
without checking this repo first. Working references live here — `pollos/infra`
for the Cloudflare provider and Terraform version, `dashboard/` for the frontend
stack. If a sibling directory already uses the thing in production and CI passes
on it, it exists. Behaviour claims need a `file:line` citation, not an inference
from a name.

CI already runs formatting, linting, typechecking and `terraform validate` — do
not re-report what those catch.

## Cap the nits

At most five Nits per review; summarise the rest as a count. If everything found
is a Nit, open the summary with "No blocking issues."

## Do not report

- Lockfiles (`package-lock.json`, `bun.lock`), vendored assets (fonts, `.vendor-cache/`)
- Generated files — `dashboard/src/routeTree.gen.ts`, `pollos/microsite/public/`
- Dependabot branches
- Missing tests on config-only or static-content changes

## Re-review convergence

After the first review of a PR, post 🔴 Important findings only. Do not raise new
Nits on later rounds — a one-line fix should not reach round five on style.

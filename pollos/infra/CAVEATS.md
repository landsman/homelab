# Tailnet caveats

What Tailscale and its Terraform provider do here that is not obvious, and what to do instead. Everything below
was seen on 2026-11-02, provider 0.29.2, Tailscale 1.104.4 on a pollos box. The working order is in the README,
[Adding a tailnet service](README.md#adding-a-tailnet-service).

## A service a box advertised before it existed is never served

A box that advertises a service (`tailscale serve --service=svc:<name> …`) before the service exists in the tailnet
is never taken as its host, and running the same command again does not fix it.

What it looks like:
- the name resolves to the service's address, and a connection to it hangs;
- the admin console lists the service with **0 hosts**;
- the box looks right everywhere: `tailscale debug prefs` lists the service under `AdvertiseServices`, and
  `tailscale serve status` serves it.

The one value that shows the problem: the box's `tailscale status --json` has no `service-host` in `Self.CapMap`.

Why: the box sends its prefs to the control plane when they change. A repeated `tailscale serve` leaves them as
they were, so the service that appeared later never hears about the box.

**Instead:**
1. Create the service first, with the apply, and only then deploy whatever advertises it. In that order it worked
   with no restart.
2. If a box advertised first, take the advertisement off and deploy again:
   `sudo tailscale serve --service=svc:<name> --https=443 off`. Restarting `tailscaled` also works, and drops the
   box from the tailnet for a few seconds.

## Every Services call is `not found (404)`: the OAuth client lacks Services Read

Without the **Read** half of the Services scope, every Services call answers `not found (404)`: the list, a read,
and the provider's create. The policy goes through in the same apply, so it looks like a wrong API path or a
missing service.

In the trust credential's editor, Read showed as ticked (greyed out) beside Write, but it had not been stored. The
token endpoint refused `scope=services:read` ("OAuth client cannot grant scopes") and granted `policy_file:read`.
Ticking Read explicitly and saving fixed it.

**Check it** with the **tailscale api check** workflow (`tailscale-api.sh check`). It prints each call's status,
Tailscale's message, and which scopes the client can grant. It never prints a body or a token, so it is safe in a
public log. `TF_LOG=DEBUG` would not be.

## A service that already exists cannot be created again

`when updating a service, addrs must contain 2 elements (400)`. The provider creates with a `PUT`, and on a service
that exists the API takes it as an update, which has to carry the service's addresses.

**Instead:** delete the service by hand and let the apply create it, or take it over with an `import` block.

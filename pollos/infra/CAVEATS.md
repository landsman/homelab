# Tailnet caveats

What Tailscale and its Terraform provider do not do here, and what to do instead.

## Tailscale Services: define the service first, then advertise it

A box that advertises a service (`tailscale serve --service=svc:<name> --https=443 …`) before the service
exists in the tailnet is never taken as its host, and later runs of the same command do not fix it. Seen
2026-11-02 on a pollos box, Tailscale 1.104.4, for two services at once.

What it looks like:
- the service name resolves to its address, and a connection to it hangs;
- the admin console lists the service with **0 hosts**;
- the box looks right everywhere: `tailscale debug prefs` lists it under `AdvertiseServices`, and
  `tailscale serve status --json` has it under `Services`.

The one value that shows the problem: the box's `tailscale status --json` has no `service-host` in
`Self.CapMap`.

Why: the box's prefs did not change after the first advertisement, so the box never sent them to the control
plane again. Defining the service afterwards does not reach the box.

**Instead:**
1. Let the apply create the service (`tailscale_service` in `tailscale.tf`) before anything advertises it, then
   deploy whatever advertises it.
2. If a box advertised first, take the advertisement off and put it back, which sends the box's prefs again:
   `tailscale serve --service=svc:<name> --https=443 off`, then the same `tailscale serve --service=…` as
   before. Or restart its daemon:

   ```sh
   sudo systemctl restart tailscaled
   ```

   Within seconds `service-host` lists the service, the console shows the host, and the name answers.
   Approving the host is the policy's job (`autoApprovers.services` in `tailscale.tf`).

## `tailscale_service` fails with `not found (404)`: the OAuth client lacks Services Read

Every Services call answers `not found (404)` without the **Read** half of the Services scope: listing, reading
and the provider's create alike. The policy goes through in the same apply, so it looks like a wrong path or a
missing service. In the trust credential's editor, Read showed as ticked (greyed out) next to Write, but it
had not been stored: the token endpoint refused `scope=services:read` ("OAuth client cannot grant scopes"), while
`policy_file:read` was granted. Ticking Read explicitly and saving fixed it (2026-11-02).

**Check it** with the **tailscale api check** workflow (`pollos/infra/tailscale-api.sh check`). It prints each
call's status and Tailscale's message, and which scopes the client can grant, and never prints a token.

## A service that already exists cannot be created again

`addrs must contain 2 elements (400)`: the provider's create is a `PUT`, and on an existing service the API reads
it as an update, which has to carry the service's addresses. A service defined by hand is taken over with an
`import` block instead, or deleted first and created by the apply.

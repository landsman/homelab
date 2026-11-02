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
1. Define the service in the admin console (**Services → Add service**, its ports) before anything
   advertises it.
2. If a box advertised first, restart its daemon:

   ```sh
   sudo systemctl restart tailscaled
   ```

   Within seconds `service-host` lists the service, the console shows the host, and the name answers.
   Approving the host is the policy's job (`autoApprovers.services` in `tailscale.tf`).

## `tailscale_service` fails with `not found (404)`

The provider (0.29.2) creates a service with `PUT /api/v2/tailnet/-/vip-services/<name>` and gets a 404. It
does the same for a service that already exists, while the policy in the same apply goes through.

Ruled out on 2026-11-02:
- **A missing scope:** *Services → Write* on the OAuth client did not change the 404.
- **A wrong tailnet:** the provider uses `-`.
- **An old API path:** the newest Go client calls the same path.
- **The plan:** the Free plan states no limit on Services, and the admin console defines them.

The real cause is not known. Finding it needs the API's own answer, and a `TF_LOG=DEBUG` apply would put the
OAuth exchange into a public Actions log.

Being investigated: the apply cannot create the services, so for now they exist because they were defined by hand,
and the next apply will fail on the same 404 until the cause is found.

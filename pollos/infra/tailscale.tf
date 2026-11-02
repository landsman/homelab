# Tailnet ACL — source of truth for tag ownership and access rules.
#
# `tag:pollos` must be declared here in tagOwners before any node or auth key
# may use it; this is the only place a tag "exists". Applying this resource
# takes ownership of the whole tailnet policy file (overwrite_existing_content),
# so keep every rule your tailnet needs in here.
#
# The acls block below is left permissive (allow-all among your own devices) to
# preserve the working Mac <-> boxes <-> Apple TV exit node setup. Tighten it to
# explicit src/dst later once everything is on the tailnet.
resource "tailscale_acl" "this" {
  overwrite_existing_content = true

  acl = jsonencode({
    tagOwners = {
      # tag:terraform is the OAuth client's own identity (provider in main.tf).
      # It must own tag:pollos so the provider can mint the tag:pollos enrollment
      # key below. The boxes carry tag:pollos but are NOT owners, so a box can't
      # mint new tag:pollos keys — only the Terraform automation can.
      "tag:terraform" = ["autogroup:admin"]
      "tag:pollos"    = ["autogroup:admin", "tag:terraform"]
    }

    acls = [
      {
        action = "accept"
        src    = ["*"]
        dst    = ["*:*"]
      },
    ]

    # Tailscale Services (tailscale_service below): a name and a tailnet address of their own, served by a box. A box
    # tagged tag:pollos may host these without an admin approving each one. The docs do not say whether the allow-all
    # rule above reaches a svc: destination, so each service gets a grant of its own.
    autoApprovers = {
      services = { for name, service in local.tailnet_services : "svc:${name}" => service.hosts }
    }

    grants = [for name, service in local.tailnet_services : {
      src = service.reach
      dst = ["svc:${name}"]
      ip  = [for port in service.ports : tostring(port)]
    }]

    # Tailscale SSH — only takes effect on nodes started with
    # `tailscale up --ssh` (TS_SSH=1). Harmless otherwise.
    #
    # src is autogroup:admin, not autogroup:member: SSH here grants root, so
    # don't hand it to every device on the tailnet (other people's phones, an
    # untrusted node). The general acls block above stays permissive on purpose
    # — this narrows only the root-shell path.
    ssh = [
      {
        action = "accept"
        src    = ["autogroup:admin"]
        dst    = ["tag:pollos"]
        users  = ["ansible", "root"]
      },
    ]
  })
}

# Tailscale Services, one entry each: which boxes may host it without an admin approving them, and who may reach it
# on which ports; the policy above is built from this map. The service itself is defined by hand in the admin
# console, BEFORE any box advertises it (`tailscale serve --service=svc:<name>`): tailscale_service fails with a 404
# here, and a box that advertised first is never taken as a host until tailscaled restarts. Both in CAVEATS.md.
locals {
  tailnet_services = {
    # A deploy console on a pollos box, on https://deploy.<tailnet>/ instead of the box's name and a port.
    deploy = {
      comment = "Deploy console on a pollos box"
      ports   = [443]
      hosts   = ["tag:pollos"]
      # Admins only: the page shows what runs and starts deploys. Every member was the first draft, and a member
      # can be someone else's device.
      reach = ["autogroup:admin"]
    }
    # Swarmpit, the swarm's web UI on a pollos box, on https://swarmpit.<tailnet>/ instead of the box's own name.
    swarmpit = {
      comment = "Swarmpit on a pollos box"
      ports   = [443]
      hosts   = ["tag:pollos"]
      reach   = ["autogroup:admin"]
    }
  }
}

# Reusable, pre-authorized auth key scoped to tag:pollos. Feed it to
# setup/005-tailscale.sh via TS_AUTHKEY; nodes come up already tagged and
# approved, no manual click in the admin console.
#
# Keep `description` to alphanumerics and spaces — Tailscale rejects punctuation
# with "description had invalid characters (400)", so no parentheses, slashes or
# dots, which rules out naming the script here.
resource "tailscale_tailnet_key" "pollos" {
  reusable      = true
  ephemeral     = false # servers must stay registered while powered off
  preauthorized = true
  description   = "pollos box enrollment"
  tags          = ["tag:pollos"]
  expiry        = 7776000 # 90 days (max), in seconds

  depends_on = [tailscale_acl.this] # tag must exist before the key references it
}

# Read with: terraform output -raw tailscale_authkey
output "tailscale_authkey" {
  value     = tailscale_tailnet_key.pollos.key
  sensitive = true
}
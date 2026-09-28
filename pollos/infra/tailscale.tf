# Tailnet ACL — source of truth for tag ownership and access rules.
#
# `tag:pollos` must be declared here in tagOwners before any node or auth key
# may use it; this is the only place a tag "exists". Applying this resource
# takes ownership of the whole tailnet policy file (overwrite_existing_content),
# so keep every rule your tailnet needs in here.
#
# The acls block lets my own devices reach everything, and the tagged boxes
# reach only each other. The boxes must not reach the Pi: forgejo-mcp serves
# Forgejo there with my token to any caller, and jesse runs arbitrary CI jobs.
# Audited 2026-09-28 before narrowing: no box held a tailnet connection to the
# Pi, and the runner reaches git.insuit.cz by its public name.
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
        # Every device I own — Macs, phones, Apple TVs, the Pi. `*:*` also
        # covers autogroup:internet, so the exit nodes keep working.
        action = "accept"
        src    = ["autogroup:member"]
        dst    = ["*:*"]
      },
      {
        action = "accept"
        src    = ["tag:pollos"]
        dst    = ["tag:pollos:*"]
      },
    ]

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
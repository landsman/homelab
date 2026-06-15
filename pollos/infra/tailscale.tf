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
      "tag:pollos" = ["autogroup:admin"]
    }

    acls = [
      {
        action = "accept"
        src    = ["*"]
        dst    = ["*:*"]
      },
    ]

    # Tailscale SSH — only takes effect on nodes started with
    # `tailscale up --ssh` (TS_SSH=1). Harmless otherwise.
    ssh = [
      {
        action = "accept"
        src    = ["autogroup:member"]
        dst    = ["tag:pollos"]
        users  = ["ansible", "root"]
      },
    ]
  })
}

# Reusable, pre-authorized auth key scoped to tag:pollos. Feed it to
# setup/005-tailscale.sh via TS_AUTHKEY; nodes come up already tagged and
# approved, no manual click in the admin console.
resource "tailscale_tailnet_key" "pollos" {
  reusable      = true
  ephemeral     = false # servers must stay registered while powered off
  preauthorized = true
  description   = "pollos box enrollment (setup/005-tailscale.sh)"
  tags          = ["tag:pollos"]
  expiry        = 7776000 # 90 days (max), in seconds

  depends_on = [tailscale_acl.this] # tag must exist before the key references it
}

# Read with: terraform output -raw tailscale_authkey
output "tailscale_authkey" {
  value     = tailscale_tailnet_key.pollos.key
  sensitive = true
}
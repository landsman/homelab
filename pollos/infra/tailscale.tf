# Tailnet ACL — source of truth for tag ownership and access rules.
#
# `tag:pollos` must be declared here in tagOwners before any node or auth key
# may use it; this is the only place a tag "exists". Applying this resource
# takes ownership of the whole tailnet policy file (overwrite_existing_content),
# so keep every rule your tailnet needs in here.
#
# The acls block lets my own devices reach everything. The tagged boxes reach
# each other, and the Pi on 443 only: the runner fetches mirrored actions and
# images there (../../forgejo-runner). They reach neither tag:forgejo-mcp nor
# tag:authelia: both ask for a login, but jesse runs arbitrary CI jobs, and a
# login page it cannot reach is one it cannot attack. That is why each is a node
# of its own and not a path on the Pi's 443: an ACL cannot tell `tailscale
# serve` paths apart.
resource "tailscale_acl" "this" {
  overwrite_existing_content = true

  acl = jsonencode({
    tagOwners = {
      # tag:terraform is the OAuth client's own identity (provider in main.tf).
      # It must own tag:pollos so the provider can mint the tag:pollos enrollment
      # key below. The boxes carry tag:pollos but are NOT owners, so a box can't
      # mint new tag:pollos keys — only the Terraform automation can.
      "tag:terraform"   = ["autogroup:admin"]
      "tag:pollos"      = ["autogroup:admin", "tag:terraform"]
      "tag:forgejo-mcp" = ["autogroup:admin", "tag:terraform"]
      "tag:authelia"    = ["autogroup:admin", "tag:terraform"]
    }

    # Looked up, not written down: this repository is public.
    # Both families: a client that resolves the Pi to IPv6 would be dropped.
    hosts = {
      nas    = one([for a in data.tailscale_device.nas.addresses : a if !strcontains(a, ":")])
      nas-v6 = one([for a in data.tailscale_device.nas.addresses : a if strcontains(a, ":")])
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
        dst    = ["tag:pollos:*", "nas:443", "nas-v6:443"]
      },
      {
        # forgejo-mcp fetches Authelia's discovery document and key set. Nothing
        # else is tagged to reach Authelia; my devices sign in through the rule above.
        action = "accept"
        src    = ["tag:forgejo-mcp"]
        dst    = ["tag:authelia:443"]
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

# The forgejo-mcp sidecar's one login; its state volume keeps the node after.
resource "tailscale_tailnet_key" "forgejo_mcp" {
  reusable      = false
  ephemeral     = false
  preauthorized = true
  description   = "forgejo mcp sidecar"
  tags          = ["tag:forgejo-mcp"]
  expiry        = 7776000

  depends_on = [tailscale_acl.this]
}

output "forgejo_mcp_authkey" {
  value     = tailscale_tailnet_key.forgejo_mcp.key
  sensitive = true
}

# The Authelia sidecar's one login (../../authelia), the same way.
resource "tailscale_tailnet_key" "authelia" {
  reusable      = false
  ephemeral     = false
  preauthorized = true
  description   = "authelia sidecar"
  tags          = ["tag:authelia"]
  expiry        = 7776000

  depends_on = [tailscale_acl.this]
}

output "authelia_authkey" {
  value     = tailscale_tailnet_key.authelia.key
  sensitive = true
}

data "tailscale_device" "nas" {
  hostname = "nas"
}

# Read with: terraform output -raw tailscale_authkey
output "tailscale_authkey" {
  value     = tailscale_tailnet_key.pollos.key
  sensitive = true
}
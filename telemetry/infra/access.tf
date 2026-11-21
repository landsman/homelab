# Cloudflare Access in front of Grafana on the Pi's tunnel.
#
# Two locks, both required: the Cloudflare login has to be the owner's email,
# and the request has to come from home — which, away from home, means through
# a Tailscale exit node on the home network. Cloudflare cannot see Tailscale
# itself; the home egress address is the only trace of it that reaches the edge.
#
# The tunnel's public hostname is added by hand on the Pi's tunnel (the tunnel
# is not in Terraform). Apply this first, so the hostname is never public
# without Access in front of it.

locals {
  # One allow policy per home range: rules inside `require` are ANDed, so an
  # IPv4 and an IPv6 range in a single policy could never both match. Separate
  # policies are ORed. Count, not for_each: the ranges are sensitive and
  # for_each keys cannot be.
  home_range_count = nonsensitive(length(var.home_ip_ranges))
}

# Named for who and where, not for Grafana: the same policies can guard any
# other app on the account.
resource "cloudflare_zero_trust_access_policy" "owner_from_home" {
  count      = local.home_range_count
  account_id = var.cloudflare_account_id
  name       = "owner from home ${count.index + 1}"
  decision   = "allow"

  include = [{
    email = { email = var.access_email }
  }]

  require = [{
    ip = { ip = var.home_ip_ranges[count.index] }
  }]
}

resource "cloudflare_zero_trust_access_application" "grafana" {
  account_id       = var.cloudflare_account_id
  name             = "grafana"
  type             = "self_hosted"
  domain           = var.grafana_hostname
  session_duration = "24h"

  policies = [
    for i, p in cloudflare_zero_trust_access_policy.owner_from_home : {
      id         = p.id
      precedence = i + 1
    }
  ]
}

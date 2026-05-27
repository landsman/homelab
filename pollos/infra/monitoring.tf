# Per-node uptime monitoring.
#
# For each pollos box: a remotely-managed Cloudflare Tunnel whose ingress is
# this config (http_status:200), a proxied DNS record, and a BetterStack
# monitor that polls the resulting URL. The box itself only runs a connector
# with the per-tunnel token exported below (zero account privilege on the box).
#
# Flow:  box --(outbound tunnel)--> Cloudflare --(serves 200)--> BetterStack poll
# Endpoint per node:  https://<node>.health.pollos.cz

locals {
  monitor_nodes = toset(["gus", "mike", "walter", "jesse"])
  # single label under the zone (gus-health.pollos.cz) so Universal SSL's
  # *.pollos.cz cert covers it — a nested *.health.pollos.cz would not.
  zone_domain = "pollos.cz"
}

# One tunnel per box → each node is up/down independently. config_src
# "cloudflare" keeps ingress here in Terraform (box runs token-based).
resource "cloudflare_zero_trust_tunnel_cloudflared" "health" {
  for_each   = local.monitor_nodes
  account_id = var.cloudflare_account_id
  name       = "health-${each.key}"
  config_src = "cloudflare"
}

# cloudflared answers 200 itself — no backend service to run or crash.
resource "cloudflare_zero_trust_tunnel_cloudflared_config" "health" {
  for_each   = local.monitor_nodes
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.health[each.key].id

  config = {
    ingress = [{
      service = "http_status:200"
    }]
  }
}

# <node>-health.pollos.cz  →  this tunnel (proxied / orange-cloud).
resource "cloudflare_dns_record" "health" {
  for_each = local.monitor_nodes
  zone_id  = var.cloudflare_zone_id
  name     = "${each.key}-health.${local.zone_domain}"
  type     = "CNAME"
  content  = "${cloudflare_zero_trust_tunnel_cloudflared.health[each.key].id}.cfargotunnel.com"
  proxied  = true
  ttl      = 1
}

# Public BetterStack status page at status.pollos.cz. DNS-only (grey cloud):
# BetterStack issues the TLS cert for the custom domain, so it must NOT be proxied.
resource "cloudflare_dns_record" "status_page" {
  zone_id = var.cloudflare_zone_id
  name    = "status.${local.zone_domain}"
  type    = "CNAME"
  content = "statuspage.betteruptime.com"
  proxied = false
  ttl     = 1
}

# Per-tunnel connector token — the only secret each box needs.
data "cloudflare_zero_trust_tunnel_cloudflared_token" "health" {
  for_each   = local.monitor_nodes
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.health[each.key].id
}

# Group all node monitors under "pollos" in the BetterStack dashboard.
resource "betteruptime_monitor_group" "pollos" {
  name = "pollos"
}

# BetterStack polls each endpoint; monitor_type "status" expects a 2XX.
resource "betteruptime_monitor" "health" {
  for_each           = local.monitor_nodes
  url                = "https://${each.key}-health.${local.zone_domain}"
  monitor_type       = "status"
  pronounceable_name = "pollos ${each.key}"
  monitor_group_id   = tonumber(betteruptime_monitor_group.pollos.id)
  check_frequency    = 180 # seconds (3 min)
  regions            = ["eu"]

  # Daily maintenance window — router reboot/update in this hour
  maintenance_from     = "04:55:00"
  maintenance_to       = "05:20:00"
  maintenance_timezone = "Prague"
  maintenance_days     = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
}

output "health_tunnel_tokens" {
  description = "Per-node cloudflared connector tokens for the health tunnels."
  sensitive   = true
  value = {
    for n in local.monitor_nodes : n => data.cloudflare_zero_trust_tunnel_cloudflared_token.health[n].token
  }
}
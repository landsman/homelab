# A parked zone: every hostname in it answers with a 301 to `target`, path
# dropped. No origin behind it, so the records are Cloudflare's documented
# placeholders (192.0.2.1, 100::), proxied so the redirect rule can run.
#
# Owns the zone's http_request_dynamic_redirect phase: Cloudflare allows one
# ruleset per phase per zone, so a Redirect Rule made in the dashboard is
# replaced on the next apply.

terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
    }
  }
}

variable "zone_id" {
  type = string
}

variable "zone" {
  type = string
}

variable "target" {
  type = string
}

locals {
  placeholders = { A = "192.0.2.1", AAAA = "100::" }
  hosts        = [var.zone, "www.${var.zone}", "*.${var.zone}"]
  records = {
    for pair in setproduct(local.hosts, keys(local.placeholders)) :
    "${pair[1]} ${pair[0]}" => { name = pair[0], type = pair[1] }
  }
}

resource "cloudflare_dns_record" "placeholder" {
  for_each = local.records

  zone_id = var.zone_id
  name    = each.value.name
  type    = each.value.type
  content = local.placeholders[each.value.type]
  proxied = true
  ttl     = 1
}

resource "cloudflare_ruleset" "redirect" {
  zone_id = var.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules = [{
    action      = "redirect"
    expression  = "true"
    description = "301 ${var.zone} -> ${var.target}"
    enabled     = true
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = false
        target_url = {
          value = var.target
        }
      }
    }
  }]
}

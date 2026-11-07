# Google Workspace mail on the zone apex: the MX set Google publishes.

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

locals {
  mx = {
    "aspmx.l.google.com"      = 1
    "alt1.aspmx.l.google.com" = 5
    "alt2.aspmx.l.google.com" = 5
    "aspmx2.googlemail.com"   = 10
    "aspmx3.googlemail.com"   = 10
    "aspmx4.googlemail.com"   = 10
    "aspmx5.googlemail.com"   = 10
  }
}

resource "cloudflare_dns_record" "mx" {
  for_each = local.mx

  zone_id  = var.zone_id
  name     = var.zone
  type     = "MX"
  content  = each.key
  priority = each.value
  ttl      = 1
}

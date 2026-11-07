# studioart.cz: the old studio name, kept for its mail. Points at insuit.

terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
    }
  }
}

locals {
  zone = "studioart.cz"
}

data "cloudflare_zone" "this" {
  filter = {
    name = local.zone
  }
}

module "redirect" {
  source  = "../../modules/redirect"
  zone_id = data.cloudflare_zone.this.id
  zone    = local.zone
  target  = "https://www.insuit.cz/"
}

module "mail" {
  source  = "../../modules/google-mail"
  zone_id = data.cloudflare_zone.this.id
  zone    = local.zone
}

resource "cloudflare_dns_record" "google_site_verification" {
  zone_id = data.cloudflare_zone.this.id
  name    = local.zone
  type    = "TXT"
  content = "\"google-site-verification=7RCzQEeIOoINX_YfEFV43cf9NgQH6JvNsZUDrovptrc\""
  ttl     = 1
}

# Keeps studioart.cz verified for GitHub Pages on the landsman account, so no
# other account can claim it there.
resource "cloudflare_dns_record" "github_pages_challenge" {
  zone_id = data.cloudflare_zone.this.id
  name    = "_github-pages-challenge-landsman.${local.zone}"
  type    = "TXT"
  content = "\"bc5b739ba438a8464d832c1efa60b1\""
  ttl     = 1
}

output "zone_id" {
  value = data.cloudflare_zone.this.id
}

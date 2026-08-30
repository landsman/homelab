# ---------------------------------------------------------------------------
# Zone identity records — the ones no other system recreates.
#
# Deliberately NOT here: the Tunnel CNAMEs (cloudflared owns them), the Pages
# and GitHub Pages CNAMEs, the apex/wildcard A + AAAA. Those are provisioned
# elsewhere and Terraform ignores records it doesn't declare.
#
# These already exist in the zone — import before the first apply, see README.
# ---------------------------------------------------------------------------

locals {
  # host => priority (Google Workspace)
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

  zone_id  = var.cloudflare_zone_id
  name     = "insuit.cz"
  type     = "MX"
  content  = each.key
  priority = each.value
  ttl      = 1
}

resource "cloudflare_dns_record" "google_site_verification" {
  zone_id = var.cloudflare_zone_id
  name    = "insuit.cz"
  type    = "TXT"
  content = "\"google-site-verification=T5uTZtE3bIHz4sjqYsFAX-WqKQoOOIZJqy9ukv1ky5A\""
  ttl     = 1
}

resource "cloudflare_dns_record" "github_pages_challenge" {
  zone_id = var.cloudflare_zone_id
  name    = "_github-pages-challenge-landsman.insuit.cz"
  type    = "TXT"
  content = "\"e9ede38a78b41f517f450a444a3e49\""
  ttl     = 1
}

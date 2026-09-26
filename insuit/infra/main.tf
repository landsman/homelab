terraform {
  required_version = ">= 1.15"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # Own R2 bucket and own R2 token, so insuit's state and credentials aren't
  # entangled with pollos's. See the README for the one-time create.
  backend "s3" {
    bucket                      = "insuit-cz-tf-state"
    key                         = "insuit-cz.tfstate"
    region                      = "auto"
    use_lockfile                = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ---------------------------------------------------------------------------
# Deliberately narrow: this manages the Pages projects and
# one zone setting (email obfuscation, at the bottom) — nothing else.
#
# insuit.cz is a hand-curated, live zone — Google Workspace MX, nine Tunnel
# CNAMEs (git, read, eat, archive, ip, welcome, t1, ...), a GitHub Pages
# CNAME, a proxied wildcard, and existing Redirect Rules. Terraform does not
# touch records it doesn't declare, so all of that is safe as written.
#
# What is NOT managed here, and why:
#
#   * apex and www DNS. Both already hold A + AAAA records. A CNAME cannot
#     coexist with A/AAAA on the same name, so declaring one would fail the
#     apply — or, worse, replace a record the rest of the zone depends on.
#     Cut these over by hand (see README) once you're ready to move the site.
#
#   * cloudflare_ruleset for http_request_dynamic_redirect. Cloudflare allows
#     exactly ONE ruleset per phase per zone, so managing that phase here
#     would silently overwrite every Redirect Rule already in the zone —
#     including the live www.insuit.cz -> github.com/landsman rule. Not worth
#     owning for a single apex->www redirect that already exists.
#
#   * cloudflare_pages_domain. Attaching a custom domain can provision DNS on
#     a same-account zone, which is the same collision as above. Attach the
#     domain in the dashboard as part of the manual cutover.
# ---------------------------------------------------------------------------

resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = "insuit-cz"
  production_branch = "main"
}

# link.insuit.cz: short addresses the printed CV's QR codes point at, redirected
# to each project's site. Its own project because Pages redirect rules match
# the path only — on insuit-cz they would fire on www.insuit.cz/<code> too. The
# content is insuit/links/, kept by hand. Attach the
# link.insuit.cz custom domain in the dashboard, for the reason given above.
resource "cloudflare_pages_project" "links" {
  account_id        = var.cloudflare_account_id
  name              = "insuit-links"
  production_branch = "main"
}

# The Web Analytics site for www.insuit.cz was created here, but Cloudflare
# answers every later read of it with a 403 — at Account Settings Write too — so
# any plan that refreshes it fails. Forgotten, not destroyed: the site and its
# token stay, and the pages carry the token as a literal (it is public anyway).
removed {
  from = cloudflare_web_analytics_site.site
  lifecycle {
    destroy = false
  }
}

# Scrape Shield: Cloudflare rewrites email addresses in HTML served through the
# zone, so the address on /contact isn't readable to scrapers. A single zone
# setting — no records, no rulesets — so it can't collide with the hand-kept
# zone described above. It covers every hostname in the zone, and applies to the
# site only once www is cut over to Pages; insuit-cz.pages.dev bypasses it.
resource "cloudflare_zone_setting" "email_obfuscation" {
  zone_id    = var.cloudflare_zone_id
  setting_id = "email_obfuscation"
  value      = "on"
}

terraform {
  required_version = ">= 1.15"
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # 5.26.0 breaks DNS record applies (pollos/infra/main.tf); kept out here
      # too so both stacks move together. The exact version is in the lock file.
      version = "~> 5.25, != 5.26.0"
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
# Deliberately narrow: this manages the Pages projects, their analytics, the
# link.insuit.cz record, one zone setting (email obfuscation) and the firewall
# rules on git.insuit.cz, both at the bottom — nothing else.
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
#   * cloudflare_pages_domain for apex and www. Attaching a custom domain can
#     provision DNS on a same-account zone, which is the same collision as
#     above. Attach those in the dashboard as part of the manual cutover.
#     link.insuit.cz is the exception, at the links project below.
# ---------------------------------------------------------------------------

resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = "insuit-cz"
  production_branch = "main"
}

# Pull request previews. Their own project because Chrome flags
# <branch>.insuit-cz.pages.dev as a lookalike of insuit.cz and puts a "Did you
# mean insuit.cz?" warning in front of every preview. The name must not carry
# "insuit-cz", or the warning comes back. Nothing deploys to main here.
resource "cloudflare_pages_project" "preview" {
  account_id        = var.cloudflare_account_id
  name              = "insuit-preview"
  production_branch = "main"
}

# link.insuit.cz: short addresses the printed CV's QR codes point at, redirected
# to each project's site. Its own project because Pages redirect rules match
# the path only — on insuit-cz they would fire on www.insuit.cz/<code> too. The
# content is insuit/links/, kept by hand.
resource "cloudflare_pages_project" "links" {
  account_id        = var.cloudflare_account_id
  name              = "insuit-links"
  production_branch = "main"
}

# Unlike apex and www, link had no record of its own — only the proxied
# wildcard caught it, and sent every QR code to a 404 on the wildcard's origin.
# A specific name outranks the wildcard, so this record collides with nothing.
# Attaching the domain over the API does not create the record; both are here.
resource "cloudflare_pages_domain" "links" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.links.name
  name         = "link.insuit.cz"
}

resource "cloudflare_dns_record" "links" {
  zone_id = var.cloudflare_zone_id
  name    = "link.insuit.cz"
  type    = "CNAME"
  content = "${cloudflare_pages_project.links.name}.pages.dev"
  proxied = true
  ttl     = 1
}

# Proves to Maven Central that the cz.insuit namespace is mine, so the Java
# libraries can publish under it. A TXT record sits beside the apex's A and
# AAAA without colliding.
resource "cloudflare_dns_record" "maven_central_namespace" {
  zone_id = var.cloudflare_zone_id
  name    = "insuit.cz"
  type    = "TXT"
  content = "\"9bjnjjqyme\""
  ttl     = 1
}

# Web Analytics for www.insuit.cz. Host-based with the snippet in the HTML,
# not zone-based: auto_install on the zone would inject the beacon into every
# proxied hostname on insuit.cz (git, read, eat, ...), and this config stays
# out of the zone for the reasons above. The token is public — every visitor's
# browser gets it — so the pages carry it as a literal.
resource "cloudflare_web_analytics_site" "site" {
  account_id   = var.cloudflare_account_id
  host         = "www.insuit.cz"
  auto_install = false
}

output "analytics_token" {
  value = cloudflare_web_analytics_site.site.site_token
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

# git.insuit.cz: Forgejo is public, and a crawler spread over thousands of cloud addresses
# followed every link in it (2026-11-17, it filled the NAS). The zone had no custom rules
# before this, so the one ruleset this phase allows is safe to own here.
locals {
  eu_countries = [
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
    "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
    # Territories Cloudflare locates under a code of their own, and counts as the EU too.
    "AX", "GF", "GP", "MF", "MQ", "RE", "YT",
  ]
}

resource "cloudflare_ruleset" "firewall" {
  zone_id = var.cloudflare_zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules = [
    {
      ref         = "git_eu_only"
      description = "git: EU only"
      action      = "block"
      enabled     = true
      # The member states, not the continent: no UK, Switzerland or Norway. Listed because
      # ip.src.is_in_european_union needs a Business plan. No exception for the API, the
      # registry or git: in the week before, nothing but crawlers used them from outside
      # (Cloudflare's analytics, 2026-11-10 to 17). From elsewhere, a tailnet exit node in the
      # EU gets through.
      expression = "(http.host eq \"git.insuit.cz\" and not (ip.src.country in {${join(" ", formatlist("\"%s\"", local.eu_countries))}}))"
    },
    {
      ref         = "git_challenge_browsing"
      description = "git: challenge browsing"
      action      = "managed_challenge"
      enabled     = true
      # A browser passes and keeps a cookie (challenge_ttl below); a crawler does not. Whatever
      # is not a browser is left alone, since it cannot answer a challenge: the API (runners,
      # Renovate, forgejo-mcp, the uptime check on /api/healthz), /twirp/ (a job uploading an
      # artifact), the registry, git and LFS over HTTP, release downloads. Not /raw/: only
      # browsers and the crawler asked for it.
      expression = join(" and ", [
        "(http.host eq \"git.insuit.cz\"",
        "not starts_with(http.request.uri.path, \"/api/\")",
        "not starts_with(http.request.uri.path, \"/v2/\")",
        "not starts_with(http.request.uri.path, \"/twirp/\")",
        "not ends_with(http.request.uri.path, \"/info/refs\")",
        "not ends_with(http.request.uri.path, \"/git-upload-pack\")",
        "not ends_with(http.request.uri.path, \"/git-receive-pack\")",
        "not http.request.uri.path contains \"/info/lfs/\"",
        "not http.request.uri.path contains \"/releases/download/\")",
      ])
    },
  ]
}

# How long a passed challenge holds. The default is 30 minutes, after which a comment sent from
# a page left open gets the challenge instead of an answer. Zone-wide, but git.insuit.cz is the
# only hostname with a challenge rule.
resource "cloudflare_zone_setting" "challenge_ttl" {
  zone_id    = var.cloudflare_zone_id
  setting_id = "challenge_ttl"
  value      = 604800 # a week
}

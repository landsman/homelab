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
# Deliberately narrow: this manages the Pages project, plus the zone identity
# DNS records in dns.tf (Google Workspace MX + verification TXT).
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

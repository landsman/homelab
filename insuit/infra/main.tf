terraform {
  required_version = ">= 1.15"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # Shares the pollos R2 state bucket under a separate key — same Cloudflare
  # account, same CI; a second bucket would only add another bootstrap step.
  backend "s3" {
    bucket                      = "pollos-cz-tf-state"
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

resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = "insuit-cz"
  production_branch = "main"
}

resource "cloudflare_pages_domain" "apex" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = "insuit.cz"
}

resource "cloudflare_pages_domain" "www" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = "www.insuit.cz"
}

resource "cloudflare_dns_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "insuit.cz"
  type    = "CNAME"
  content = "${cloudflare_pages_project.site.name}.pages.dev"
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www.insuit.cz"
  type    = "CNAME"
  content = "${cloudflare_pages_project.site.name}.pages.dev"
  proxied = true
  ttl     = 1
}

# Apex is primary here (mirror of the pollos.cz rule, direction flipped).
resource "cloudflare_ruleset" "redirect_www_to_apex" {
  zone_id = var.cloudflare_zone_id
  name    = "Redirect www to apex"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules = [{
    action      = "redirect"
    expression  = "(http.host eq \"www.insuit.cz\")"
    description = "301 www.insuit.cz -> insuit.cz"
    enabled     = true
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://insuit.cz\", http.request.uri.path)"
        }
      }
    }
  }]
}

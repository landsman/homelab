terraform {
  required_version = ">= 1.15"
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # Kept in step with insuit/infra/main.tf, whose account and token this
      # uses: 5.26.0 breaks DNS record applies. The exact version is in the lock file.
      version = "~> 5.25, != 5.26.0"
    }
  }

  # insuit's R2 bucket and R2 token, under a key of its own: the same Cloudflare
  # account, so a second bucket and a second token would buy nothing but setup.
  backend "s3" {
    bucket                      = "insuit-cz-tf-state"
    key                         = "music-insuit-cz.tfstate"
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
# The Pages projects, music.insuit.cz on the site, and that one DNS record.
# insuit/infra/main.tf keeps out of the zone's DNS because its apex and www
# collide with records the rest of the zone depends on; music.insuit.cz is a
# single CNAME that only ever served this app, so it is taken over here. Every
# other record in the zone stays hand-kept. The Supabase backend does not move;
# music deploys it itself.
# ---------------------------------------------------------------------------

resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = "music-insuit-cz"
  production_branch = "main"
}

# Pull request previews, in a project of their own like insuit-preview: no
# "insuit-cz" in the name, or Chrome flags <branch>.<project>.pages.dev as a
# lookalike of insuit.cz. Nothing deploys to main here.
#
# It already exists: the first PR's preview needed it before any apply, so CI
# created it once with wrangler. The import adopts it on the first apply and
# is a no-op on every one after.
import {
  to = cloudflare_pages_project.preview
  id = "${var.cloudflare_account_id}/music-preview"
}

resource "cloudflare_pages_project" "preview" {
  account_id        = var.cloudflare_account_id
  name              = "music-preview"
  production_branch = "main"
}

resource "cloudflare_pages_domain" "site" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = "music.insuit.cz"
}

# The record already exists — the CNAME to GitHub Pages this replaces. It is
# looked up by name and imported, so no record id is written down, and the
# first apply repoints it rather than failing on a duplicate.
data "cloudflare_dns_records" "music" {
  zone_id = var.cloudflare_zone_id
  name    = { exact = "music.insuit.cz" }
}

import {
  to = cloudflare_dns_record.music
  id = "${var.cloudflare_zone_id}/${data.cloudflare_dns_records.music.result[0].id}"
}

# The project's real hostname, not its name: Cloudflare suffixes a name already
# taken on pages.dev (music-preview became music-preview-420).
resource "cloudflare_dns_record" "music" {
  zone_id = var.cloudflare_zone_id
  name    = "music.insuit.cz"
  type    = "CNAME"
  content = cloudflare_pages_project.site.subdomain
  proxied = true
  ttl     = 1
}

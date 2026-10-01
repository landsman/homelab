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
# The Pages projects only, for the reasons insuit/infra/main.tf gives:
# music.insuit.cz sits in the hand-kept insuit.cz zone, so its DNS record and
# the custom domain are attached by hand at the cutover (music/README.md), not
# declared here. The Supabase backend does not move; music deploys it itself.
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

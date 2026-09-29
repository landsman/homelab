terraform {
  required_version = ">= 1.15"
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # 5.26.0 breaks DNS record applies (pollos/infra/main.tf); kept out here
      # too so the stacks move together. The exact version is in the lock file.
      version = "~> 5.25, != 5.26.0"
    }
  }

  # insuit's R2 bucket under a key of its own: a separate state, no second
  # bucket or R2 token to create. The R2 token is scoped to the bucket, not the
  # key, so this deploy could technically write insuit's state too.
  backend "s3" {
    bucket                      = "insuit-cz-tf-state"
    key                         = "telemetry.tfstate"
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

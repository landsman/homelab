terraform {
  required_version = ">= 1.15"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # Own R2 bucket and own R2 token, so this state and its credentials aren't
  # entangled with any other stack's. See the README for the one-time create.
  backend "s3" {
    bucket                      = "homelab-telemetry-tf-state"
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

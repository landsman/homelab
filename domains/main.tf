terraform {
  required_version = ">= 1.15"
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # 5.26.0 breaks DNS record applies (pollos/infra/main.tf). The exact
      # version is in the lock file.
      version = "~> 5.25, != 5.26.0"
    }
  }

  # insuit's bucket and R2 token, under a key of its own: the state holds no
  # secrets, so a bucket of its own would only add credentials to keep.
  backend "s3" {
    bucket                      = "insuit-cz-tf-state"
    key                         = "domains.tfstate"
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

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# One module per zone, in zones/<name>-<tld>.
module "studioart_cz" {
  source = "./zones/studioart-cz"
}

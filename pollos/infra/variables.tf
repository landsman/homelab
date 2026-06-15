variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "betteruptime_api_token" {
  type      = string
  sensitive = true
}

variable "tailscale_api_key" {
  type      = string
  sensitive = true
}

# Tailnet identifier the API key belongs to, e.g. the org/email or "-" for the
# key's default tailnet.
variable "tailscale_tailnet" {
  type    = string
  default = "-"
}

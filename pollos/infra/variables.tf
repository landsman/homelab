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

variable "tailscale_oauth_client_id" {
  type      = string
  sensitive = true
}

variable "tailscale_oauth_client_secret" {
  type      = string
  sensitive = true
}

# Tailnet identifier the OAuth client belongs to, e.g. the org/email or "-" for
# the client's default tailnet.
variable "tailscale_tailnet" {
  type    = string
  default = "-"
}

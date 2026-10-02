variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

# The email and the home addresses are secrets, not because either is hard to
# guess, but because this repo is public.
variable "access_email" {
  type      = string
  sensitive = true

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+$", var.access_email))
    error_message = "access_email must be an email address — an unset GitHub secret arrives as an empty string."
  }
}

# Public ranges home traffic leaves from, IPv4 and IPv6: a browser on IPv6 is
# otherwise locked out by a v4-only rule. As a secret: ["203.0.113.7/32", "2001:db8:1234::/56"]
variable "home_ip_ranges" {
  type      = list(string)
  sensitive = true

  validation {
    condition     = length(var.home_ip_ranges) > 0 && alltrue([for r in var.home_ip_ranges : can(cidrhost(r, 0))])
    error_message = "home_ip_ranges must be a non-empty list of CIDR ranges."
  }
}

variable "grafana_hostname" {
  type = string

  validation {
    condition     = length(var.grafana_hostname) > 0
    error_message = "grafana_hostname is empty — set the GRAFANA_HOSTNAME variable."
  }
}

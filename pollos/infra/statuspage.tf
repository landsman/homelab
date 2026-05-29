# Public status page (status.pollos.cz) and its per-node resources, fully
# managed in Terraform. Each node resource is wired to its monitor from
# monitoring.tf, so maintenance-schedule.tf can reference the ids directly —
# no hardcoded ids, no UI clicking.
#
# NOTE: BetterStack requires a unique subdomain/custom_domain. The pre-existing
# UI status page must be deleted before the first apply, otherwise creation
# fails with a duplicate-subdomain error.

resource "betteruptime_status_page" "pollos" {
  company_name  = "Los Pollos Hermanos"
  company_url   = "https://www.pollos.cz"
  subdomain     = "landsman"
  custom_domain = "status.pollos.cz"
  timezone      = "Prague"

  design = "v2" # modern look
  theme  = "dark"
  layout = "vertical"

  # Optional branding — point at hosted logos once available:
  # logo_url      = "https://www.pollos.cz/icons/logo.png"
  # dark_logo_url = "https://www.pollos.cz/icons/logo-dark.png"
}

# One public resource per node, backed by its uptime monitor.
resource "betteruptime_status_page_resource" "node" {
  for_each = local.monitor_nodes

  status_page_id = betteruptime_status_page.pollos.id
  resource_id    = tonumber(betteruptime_monitor.health[each.key].id)
  resource_type  = "Monitor"
  public_name    = "pollos ${each.key}"
  widget_type    = "history"
}

# Public status page (status.pollos.cz), its sections and resources, fully
# managed in Terraform. Node resources are wired to their monitors from
# monitoring.tf, so maintenance-schedule.tf can reference the ids directly —
# no hardcoded ids, no UI clicking.
#
# NOTE: BetterStack requires a unique subdomain/custom_domain. The pre-existing
# UI status page must be deleted before the first apply, otherwise creation
# fails with a duplicate-subdomain error.

resource "betteruptime_status_page" "pollos" {
  company_name  = "Los Pollos Hermanos"
  company_url   = "https://betterstack.com/?ref=b-dowu"
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

# Sections, top to bottom.
resource "betteruptime_status_page_section" "nodes" {
  status_page_id = betteruptime_status_page.pollos.id
  name           = "servers"
  position       = 0
}

resource "betteruptime_status_page_section" "services" {
  status_page_id = betteruptime_status_page.pollos.id
  name           = "apps"
  position       = 1
}

# One public resource per node in the "servers" section.
resource "betteruptime_status_page_resource" "node" {
  for_each = local.monitor_nodes

  status_page_id         = betteruptime_status_page.pollos.id
  status_page_section_id = tonumber(betteruptime_status_page_section.nodes.id)
  resource_id            = tonumber(betteruptime_monitor.health[each.key].id)
  resource_type          = "Monitor"
  public_name            = "pollos ${each.key}"
  widget_type            = "history"
}

# insuit.cz apps shown in the "apps" section. Each gets its own monitor.
locals {
  status_services = {
    welcome = { url = "https://welcome.insuit.cz", public_name = "welcome.insuit.cz", check_frequency = 1800 }
    eat     = { url = "https://eat.insuit.cz", public_name = "eat.insuit.cz", check_frequency = 300 }
    git     = { url = "https://git.insuit.cz", public_name = "git.insuit.cz", check_frequency = 300 }
    read    = { url = "https://read.insuit.cz", public_name = "read.insuit.cz", check_frequency = 300 }
    music   = { url = "https://music.insuit.cz", public_name = "music.insuit.cz", check_frequency = 1800 }
  }
}

# Group all app monitors under "apps" in the BetterStack dashboard.
resource "betteruptime_monitor_group" "apps" {
  name = "apps"
}

resource "betteruptime_monitor" "service" {
  for_each = local.status_services

  url                = each.value.url
  monitor_type       = "status"
  pronounceable_name = each.value.public_name
  monitor_group_id   = tonumber(betteruptime_monitor_group.apps.id)
  check_frequency    = each.value.check_frequency # seconds (per service)
  regions            = ["eu"]
}

resource "betteruptime_status_page_resource" "service" {
  for_each = local.status_services

  status_page_id         = betteruptime_status_page.pollos.id
  status_page_section_id = tonumber(betteruptime_status_page_section.services.id)
  resource_id            = tonumber(betteruptime_monitor.service[each.key].id)
  resource_type          = "Monitor"
  public_name            = each.value.public_name
  widget_type            = "history"
}

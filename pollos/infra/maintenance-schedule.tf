# Non-periodic, planned maintenance announcements on the BetterStack status page.
#
# The better-uptime provider has no status-page-report resource, so each report
# is managed through the generic `restapi` provider: created on `apply`, DELETEd
# on `destroy` or when removed from `maintenance_events`.
#
# To schedule maintenance: add an entry to `maintenance_windows`, `apply`, do the
# work. Once done, delete the entry and `apply` again — the report is removed.
# These are public announcements only; they do NOT silence monitor alerts (the
# per-node daily window in monitoring.tf handles routine mutes).

locals {
  # One entry = one maintenance window for one node. Entries are independent, so
  # schedule a single server, or several (each with its own start) for a rolling
  # upgrade. The map key is a free-form id, only used for Terraform addressing.
  maintenance_windows = {
    ram_upgrade_gus = {
      node     = "gus"
      title    = "RAM upgrade 16 → 32 GB"
      message  = "Replacing RAM in gus. ~2h downtime expected."
      start    = "2026-05-29T22:00:00+02:00" # 22:00 Prague (CEST)
      duration = "2h"
    }
  }

  maintenance_reports = {
    for k, w in local.maintenance_windows : k => {
      node      = w.node
      title     = "${w.title} — ${w.node}"
      message   = w.message
      starts_at = w.start
      ends_at   = timeadd(w.start, w.duration)
    }
  }
}

# Recreate a report when its event definition changes. ignore_changes on the
# restapi_object (below) suppresses the false JSON:API drift but would also
# swallow real edits to a window; triggers_replace bumps this resource whenever
# the report content changes, which then forces the report to be recreated.
resource "terraform_data" "maintenance_trigger" {
  for_each         = local.maintenance_reports
  triggers_replace = each.value
}

resource "restapi_object" "maintenance" {
  for_each = local.maintenance_reports

  path         = "/status-pages/${betteruptime_status_page.pollos.id}/status-reports"
  id_attribute = "data/id" # BetterStack wraps the created object under "data"

  data = jsonencode({
    report_type = "maintenance"
    title       = each.value.title
    message     = each.value.message
    starts_at   = each.value.starts_at
    ends_at     = each.value.ends_at
    affected_resources = [{
      # tonumber so jsonencode emits an integer — the API rejects a quoted id.
      status_page_resource_id = tonumber(betteruptime_status_page_resource.node[each.value.node].id)
      status                  = "maintenance"
    }]
  })

  # BetterStack is JSON:API — GET nests attributes under data.attributes while
  # POST expects them at the root, so the provider would otherwise see perpetual
  # drift on `data`. Suppress that, but recreate the report when the event
  # definition actually changes (via the trigger above).
  lifecycle {
    ignore_changes       = [data]
    replace_triggered_by = [terraform_data.maintenance_trigger[each.key]]
  }
}

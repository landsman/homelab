# Non-periodic, planned maintenance announcements on the BetterStack status page.
#
# The better-uptime provider has no status-page-report resource, so each report
# is managed through the generic `restapi` provider: created on `apply`, DELETEd
# on `destroy` or when removed from `maintenance_events`.
#
# To schedule maintenance: add an entry to `maintenance_events`, `apply`, do the
# work. Once done, delete the entry and `apply` again — the reports are removed.
# These are public announcements only; they do NOT silence monitor alerts (the
# per-node daily window in monitoring.tf handles routine mutes).

locals {
  # Keyed by event name. `order` lists the nodes in the sequence they go down;
  # each gets a `step_h`-hour window, staggered so only one is down at a time.
  maintenance_events = {
    ram_upgrade = {
      title   = "RAM upgrade 16 → 32 GB"
      message = "Replacing RAM in each pollos node, one at a time. ~2h downtime expected per node."
      start   = "2026-06-06T10:00:00Z" # first node's window start (RFC3339, UTC)
      step_h  = 2                      # downtime per node, hours
      order   = ["gus", "mike", "walter", "jesse"]
    }
  }

  # Flatten events into one report per node, staggered by step_h hours. The
  # leading {} keeps merge() valid when maintenance_events is empty (otherwise
  # merge([]...) errors); the index in the key keeps it unique if a node repeats.
  maintenance_reports = merge({}, [
    for ev, cfg in local.maintenance_events : {
      for i, node in cfg.order : "${ev}.${i}-${node}" => {
        node      = node
        title     = "${cfg.title} — ${node}"
        message   = cfg.message
        starts_at = timeadd(cfg.start, "${i * cfg.step_h}h")
        ends_at   = timeadd(cfg.start, "${(i + 1) * cfg.step_h}h")
      }
    }
  ]...)
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

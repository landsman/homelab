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
  # status.pollos.cz lives in the BetterStack UI (no TF data source exists for
  # status pages), so its id and per-node resource ids are pinned here. They are
  # stable identifiers, not secrets — read them once with:
  #   curl -s https://uptime.betterstack.com/api/v2/status-pages/208946/resources \
  #     -H "Authorization: Bearer $TF_VAR_betteruptime_api_token" \
  #     | jq '.data[] | {id, public_name: .attributes.public_name}'
  status_page_id = "208946"
  status_page_resource_ids = {
    gus    = "" # TODO: fill from the curl above
    mike   = ""
    walter = ""
    jesse  = ""
  }

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

  # Flatten events into one report per node, staggered by step_h hours.
  maintenance_reports = merge([
    for ev, cfg in local.maintenance_events : {
      for i, node in cfg.order : "${ev}.${node}" => {
        node      = node
        title     = "${cfg.title} — ${node}"
        message   = cfg.message
        starts_at = timeadd(cfg.start, "${i * cfg.step_h}h")
        ends_at   = timeadd(cfg.start, "${(i + 1) * cfg.step_h}h")
      }
    }
  ]...)
}

resource "restapi_object" "maintenance" {
  for_each = local.maintenance_reports

  path         = "/status-pages/${local.status_page_id}/status-reports"
  id_attribute = "data/id" # BetterStack wraps the created object under "data"

  data = jsonencode({
    report_type = "maintenance"
    title       = each.value.title
    message     = each.value.message
    starts_at   = each.value.starts_at
    ends_at     = each.value.ends_at
    affected_resources = [{
      status_page_resource_id = local.status_page_resource_ids[each.value.node]
      status                  = "maintenance"
    }]
  })

  # BetterStack is JSON:API — GET nests attributes under data.attributes while
  # POST expects them at the root, so the provider would otherwise see perpetual
  # drift on `data`. These are one-shot announcements; no reconciliation needed.
  lifecycle {
    ignore_changes = [data]
  }
}

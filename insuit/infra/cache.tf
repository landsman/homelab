# ---------------------------------------------------------------------------
# Browser cache — let Pages' own Cache-Control reach the browser.
#
# Pages serves every asset with `Cache-Control: public, max-age=0,
# must-revalidate`: ask on each load, take the new file when the ETag moves.
# The zone's Browser Cache TTL (4 hours, Cloudflare's default) was overriding
# that, because Cloudflare rewrites the header whenever the origin's max-age is
# LOWER than the setting. Same deploy, same file, two hostnames:
#
#   insuit-cz.pages.dev/assets/css/page.css   max-age=0,     must-revalidate
#   www.insuit.cz/assets/css/page.css         max-age=14400, must-revalidate
#
# So a browser that had already loaded the site kept the old CSS for up to four
# hours and never asked for the new one — a deploy rendered half-applied, new
# HTML against stale stylesheets. No purge fixes it: a purge clears Cloudflare's
# edge, and that copy is in the visitor's browser.
#
# A cache rule rather than the browser_cache_ttl zone setting, for two reasons.
# The setting's "respect existing headers" value is rejected by the zone
# settings API these days, and it would apply zone-wide — the expression below
# pins this to the site's host, so the Tunnel subdomains keep the 4-hour
# default they have today.
#
# WARNING, the same one-per-phase deal as the redirect ruleset (see main.tf):
# Terraform now owns http_request_cache_settings for insuit.cz. Nothing else
# was using that phase, but a Cache Rule added by hand in the dashboard from
# here on has to be declared here too, or the next apply removes it.
# ---------------------------------------------------------------------------

resource "cloudflare_ruleset" "cache" {
  zone_id = var.cloudflare_zone_id
  name    = "Cache"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules = [
    {
      ref         = "respect_pages_cache_control"
      description = "www.insuit.cz: browsers revalidate, so a deploy lands on the next load"
      expression  = "(http.host eq \"www.insuit.cz\")"
      action      = "set_cache_settings"
      action_parameters = {
        browser_ttl = {
          mode = "respect_origin"
        }
      }
    }
  ]
}

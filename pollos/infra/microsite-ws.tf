# Custom domain for the microsite-ws Worker (realtime WebSocket relay; live
# visitor cursors today). The Worker *script* is deployed by wrangler in CI
# (pollos/microsite-ws) — same split as the Pages site: Terraform owns the
# resource/domain, wrangler ships the code. The `worker` CI job runs before
# `terraform apply`, so the script exists when this domain binds to it.
resource "cloudflare_workers_custom_domain" "microsite_ws" {
  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = "microsite-ws.pollos.cz"
  service    = "microsite-ws"
}
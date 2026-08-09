# Custom domain for the microsite-ws Worker (realtime WebSocket relay; live
# visitor cursors today). The Worker *script* is deployed by wrangler in CI
# (pollos/microsite-ws) — same split as the Pages site: Terraform owns the
# resource/domain, wrangler ships the code. CI applies Terraform before the
# `worker` job, so on a *first* deploy of a new Worker the script won't exist
# yet and this resource fails — deploy it once by hand (`make deploy` in
# pollos/microsite-ws), then re-run. Steady-state applies are a no-op.
resource "cloudflare_workers_custom_domain" "microsite_ws" {
  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = "microsite-ws.pollos.cz"
  service    = "microsite-ws"
}
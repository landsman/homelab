/**
 * Cloudflare Web Analytics. The token comes from Terraform at deploy time
 * (VITE_CF_BEACON_TOKEN); without one — `make dev`, the tests — nothing loads,
 * so a local page view never counts as a visit.
 */
export function loadAnalytics() {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN;
  if (!token) return;

  const beacon = document.createElement("script");
  beacon.defer = true;
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token });
  document.head.append(beacon);
}

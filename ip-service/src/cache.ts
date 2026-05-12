/**
 * Anti-caching headers (unified way for Cloudflare, browsers, and CDNs)
 */
export const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store", // Specifically, for Cloudflare and other CDNs
  "Surrogate-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
} as const;

/**
 * Apply anti-caching headers to a Response object.
 */
export function applyNoCacheHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(NO_CACHE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

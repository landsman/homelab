import type { StatusPageData } from './types'

export async function fetchSimpleCheck(url: string, versionPath?: string): Promise<StatusPageData> {
  try {
    // First, try a standard fetch with default mode ('cors').
    // This will work if the server supports CORS or if we are on the same origin.
    const response = await fetch(url, { cache: 'no-store' })
    if (response.ok) {
      let version: string | undefined
      if (versionPath) {
        try {
          // We must clone the response if we were to read it twice, but here we only read it once.
          const json = await response.json()
          version = versionPath.split('.').reduce((obj, key) => obj?.[key], json)
        } catch (e) {
          console.error(`Failed to parse version JSON from ${url}:`, e)
        }
      }

      return {
        status: { indicator: 'none', description: 'ok' },
        components: [],
        incidents: [],
        version,
      }
    }

    // If response is not OK (e.g. 404, 500, etc.)
    throw new Error(`HTTP ${response.status}`)
  } catch (err) {
    // If the error is a TypeError, it's very likely a CORS or network failure in a browser.
    // In that case, we try the 'no-cors' fallback to at least confirm reachability.
    if (err instanceof TypeError) {
      try {
        // 'no-cors' mode will always result in an opaque response (status 0, no body).
        // But if this fetch doesn't throw, it means the server is reachable and responded.
        await fetch(url, { mode: 'no-cors', cache: 'no-store' })
        return {
          status: { indicator: 'none', description: 'responding' },
          components: [],
          incidents: [],
        }
      } catch (noCorsErr) {
        console.error(`Simple check failed for ${url} (even with no-cors):`, noCorsErr)
        return {
          status: { indicator: 'critical', description: 'offline' },
          components: [],
          incidents: [],
        }
      }
    }

    // For other errors (like the HTTP error we threw above), we report the status.
    console.error(`Simple check failed for ${url}:`, err)
    return {
      status: { indicator: 'critical', description: (err as Error).message || 'offline' },
      components: [],
      incidents: [],
    }
  }
}

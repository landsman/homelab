// Proxy paths used by the app at runtime.
// In development (make dev): Vite proxies these paths — see vite.config.ts.
// In production (Docker): nginx proxies these paths — see docker/nginx.conf.
//
// All proxy paths are mounted under the app's base path (Vite `base` / nginx
// location), so client requests resolve to `${BASE_URL}proxy/...` and
// Vite/nginx match the full prefixed path.

export const RELATIVE_PROXY_PATHS = {
  STATUS_CODEBERG_ORG: 'proxy/status-codeberg-org',
  SLACK_STATUS_COM: 'proxy/slack-status-com',
} as const

function normalizeBase(basePath: string): string {
  return basePath.endsWith('/') ? basePath : `${basePath}/`
}

export function buildProxyPaths(basePath: string) {
  const prefix = normalizeBase(basePath)
  return {
    STATUS_CODEBERG_ORG: `${prefix}${RELATIVE_PROXY_PATHS.STATUS_CODEBERG_ORG}`,
    SLACK_STATUS_COM: `${prefix}${RELATIVE_PROXY_PATHS.SLACK_STATUS_COM}`,
  } as const
}

// Vite dev server proxy config — built from the same base used by `defineConfig`.
export function buildProxies(basePath: string) {
  const paths = buildProxyPaths(basePath)
  return {
    [paths.STATUS_CODEBERG_ORG]: {
      target: 'https://status.codeberg.org',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(paths.STATUS_CODEBERG_ORG, ''),
    },
    [paths.SLACK_STATUS_COM]: {
      target: 'https://slack-status.com',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(paths.SLACK_STATUS_COM, ''),
    },
  }
}

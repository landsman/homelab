// Runtime base path. Set in index.html as `window.__BASE_PATH__` and rewritten
// at container start by docker/30-substitute-base-path.sh from the BASE_PATH
// env var. Falls back to '/' for dev or when the script is absent.

declare global {
  interface Window {
    __BASE_PATH__?: string
  }
}

function normalize(raw: string | undefined): string {
  if (!raw) return '/'
  return raw.endsWith('/') ? raw : `${raw}/`
}

export const BASE_PATH: string = normalize(
  typeof window !== 'undefined' ? window.__BASE_PATH__ : undefined
)

// Without trailing slash — handy for routers that treat '' as no basepath.
export const ROUTER_BASEPATH: string = BASE_PATH.replace(/\/$/, '')

// Resolve a public-folder asset path against the runtime base. Pass-through
// for absolute URLs (http://, https://, //, data:, blob:).
export function resolveAsset(src: string): string {
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(src)) return src
  return `${BASE_PATH}${src.replace(/^\//, '')}`
}

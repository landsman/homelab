import { buildProxyPaths } from '../../../proxy.config'
import { BASE_PATH } from './base-path'

// Client runtime proxy paths — resolved against the runtime base path so
// requests go through the same prefix the app is mounted at.
export const PROXY_PATHS = buildProxyPaths(BASE_PATH)

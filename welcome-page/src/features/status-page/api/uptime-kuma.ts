import type { StatusPageData, StatusComponent } from './types'
import { PROXY_PATHS } from '../../../app/config/routing/proxy-paths'

interface UptimeKumaMonitor {
  id: number
  name: string
  type: string
}

interface UptimeKumaGroup {
  id: number
  name: string
  monitorList: UptimeKumaMonitor[]
}

interface UptimeKumaPageResponse {
  publicGroupList: UptimeKumaGroup[]
}

interface UptimeKumaHeartbeat {
  status: number // 1 = up, 0 = down
}

interface UptimeKumaHeartbeatResponse {
  heartbeatList: Record<string, UptimeKumaHeartbeat[]>
  uptimeList: Record<string, number>
}

function heartbeatStatusToComponent(_monitorId: number, heartbeats: UptimeKumaHeartbeat[]): string {
  if (!heartbeats || heartbeats.length === 0) return 'unknown'
  const latest = heartbeats[heartbeats.length - 1]
  return latest.status === 1 ? 'operational' : 'major_outage'
}

export async function fetchUptimeKuma(_baseUrl: string, slug: string): Promise<StatusPageData> {
  const base = PROXY_PATHS.STATUS_CODEBERG_ORG
  const [pageRes, heartbeatRes] = await Promise.all([
    fetch(`${base}/api/status-page/${slug}`, { cache: 'no-store' }),
    fetch(`${base}/api/status-page/heartbeat/${slug}`, { cache: 'no-store' }),
  ])

  if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)

  const page = (await pageRes.json()) as UptimeKumaPageResponse
  const heartbeats = heartbeatRes.ok
    ? ((await heartbeatRes.json()) as UptimeKumaHeartbeatResponse)
    : { heartbeatList: {}, uptimeList: {} }

  const components: StatusComponent[] = page.publicGroupList.flatMap(group =>
    group.monitorList.map(monitor => ({
      id: String(monitor.id),
      name: monitor.name,
      status: heartbeatStatusToComponent(
        monitor.id,
        heartbeats.heartbeatList[String(monitor.id)] ?? []
      ),
      group: false,
      group_id: null,
    }))
  )

  const anyDown = components.some(c => c.status === 'major_outage')
  const indicator = anyDown ? 'major' : 'none'
  const description = anyDown ? 'Service disruption' : 'ok'

  return {
    status: { indicator, description },
    components,
    incidents: [],
  }
}

import { match } from 'ts-pattern'
import type { StatusPageData, StatusComponent } from './types'

interface InstatusPageResponse {
  page: { name: string; url: string; status: string }
}

interface InstatusComponentsResponse {
  components: Array<{
    id: string
    name: string
    status: string
    group: string | null
  }>
}

function instatusPageStatusToIndicator(status: string): string {
  return match(status)
    .with('UP', () => 'none')
    .with('UNDERMAINTENANCE', () => 'maintenance')
    .otherwise(() => 'minor')
}

function instatusComponentStatus(status: string): string {
  return match(status)
    .with('OPERATIONAL', () => 'operational')
    .with('DEGRADED', () => 'degraded_performance')
    .with('PARTIALOUTAGE', () => 'partial_outage')
    .with('MAJOROUTAGE', () => 'major_outage')
    .with('UNDERMAINTENANCE', () => 'under_maintenance')
    .otherwise(() => 'operational')
}

export async function fetchInstatus(baseUrl: string): Promise<StatusPageData> {
  const [summaryRes, componentsRes] = await Promise.all([
    fetch(`${baseUrl}/summary.json`, { cache: 'no-store' }),
    fetch(`${baseUrl}/components.json`, { cache: 'no-store' }),
  ])
  if (!summaryRes.ok) throw new Error(`HTTP ${summaryRes.status}`)
  const summary = (await summaryRes.json()) as InstatusPageResponse
  const indicator = instatusPageStatusToIndicator(summary.page.status)

  let components: StatusComponent[] = []
  if (componentsRes.ok) {
    const data = (await componentsRes.json()) as InstatusComponentsResponse
    components = data.components.map(c => ({
      id: c.id,
      name: c.name,
      status: instatusComponentStatus(c.status),
      group: false,
      group_id: null,
    }))
  }

  return {
    status: { indicator, description: indicator === 'none' ? 'ok' : summary.page.status },
    components,
    incidents: [],
  }
}

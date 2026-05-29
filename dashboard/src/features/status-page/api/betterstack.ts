import { match } from 'ts-pattern'
import type { StatusPageData, StatusComponent, Incident, IncidentUpdate } from './types'

// Better Stack status pages expose a JSON:API document at `${baseUrl}/index.json`.
// https://betterstack.com/docs/uptime/status-pages/subscribing-to-status-updates/subscribing-to-api/

interface BetterStackResource {
  id: string
  type: 'status_page_resource'
  attributes: { public_name: string; status: string }
}

interface BetterStackUpdate {
  id: string
  type: 'status_update'
  attributes: { message: string; published_at: string | null }
}

interface BetterStackReport {
  id: string
  type: 'status_report'
  attributes: { title: string; report_type: string; aggregate_state: string }
  relationships?: { status_updates?: { data: Array<{ id: string }> } }
}

type BetterStackIncluded = BetterStackResource | BetterStackUpdate | BetterStackReport

interface BetterStackResponse {
  data: { attributes: { aggregate_state: string } }
  included?: BetterStackIncluded[]
}

function aggregateToIndicator(state: string): string {
  return match(state)
    .with('operational', () => 'none')
    .with('degraded', () => 'minor')
    .with('downtime', () => 'major')
    .with('maintenance', () => 'maintenance')
    .otherwise(() => 'minor')
}

function resourceStatus(status: string): string {
  return match(status)
    .with('operational', () => 'operational')
    .with('degraded', () => 'degraded_performance')
    .with('downtime', () => 'major_outage')
    .with('maintenance', () => 'under_maintenance')
    .otherwise(() => 'operational')
}

export async function fetchBetterStack(baseUrl: string): Promise<StatusPageData> {
  const res = await fetch(`${baseUrl}/index.json`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as BetterStackResponse

  const included = data.included ?? []
  const indicator = aggregateToIndicator(data.data.attributes.aggregate_state)

  const components: StatusComponent[] = included
    .filter((x): x is BetterStackResource => x.type === 'status_page_resource')
    .filter(r => r.attributes.status !== 'not_monitored')
    .map(r => ({
      id: r.id,
      name: r.attributes.public_name,
      status: resourceStatus(r.attributes.status),
      group: false,
      group_id: null,
    }))

  const updatesById = new Map<string, BetterStackUpdate>(
    included.filter((x): x is BetterStackUpdate => x.type === 'status_update').map(u => [u.id, u])
  )

  const incidents: Incident[] = included
    .filter((x): x is BetterStackReport => x.type === 'status_report')
    .filter(r => r.attributes.aggregate_state !== 'resolved')
    .map(r => {
      const updates: IncidentUpdate[] = (r.relationships?.status_updates?.data ?? [])
        .map(ref => updatesById.get(ref.id))
        .filter((u): u is BetterStackUpdate => Boolean(u))
        .map(u => ({ body: u.attributes.message, created_at: u.attributes.published_at ?? '' }))
      return {
        id: r.id,
        name: r.attributes.title,
        status:
          r.attributes.report_type === 'maintenance' ? 'maintenance' : r.attributes.aggregate_state,
        incident_updates: updates,
      }
    })

  return {
    status: {
      indicator,
      description: indicator === 'none' ? 'ok' : data.data.attributes.aggregate_state,
    },
    components,
    incidents,
  }
}

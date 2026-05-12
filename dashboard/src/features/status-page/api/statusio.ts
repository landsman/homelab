import { match } from 'ts-pattern'
import type { StatusPageData, Incident } from './types'

function statusioCodeToIndicator(code: number): string {
  return match(code)
    .with(100, () => 'none')
    .with(200, () => 'maintenance')
    .with(300, () => 'minor')
    .with(400, () => 'major')
    .otherwise(() => 'critical')
}

function statusioCodeToComponentStatus(code: number): string {
  return match(code)
    .with(100, () => 'operational')
    .with(200, () => 'under_maintenance')
    .with(300, () => 'degraded_performance')
    .with(400, () => 'partial_outage')
    .otherwise(() => 'major_outage')
}

interface StatusioResponse {
  result: {
    status_overall: { status: string; status_code: number }
    status: Array<{ id: string; name: string; status: string; status_code: number }>
    incidents: Array<{
      _id: string
      name: string
      status: string
      messages?: Array<{ details: string; created?: string }>
    }>
    maintenance: {
      active: Array<{
        _id: string
        name: string
        messages?: Array<{ details: string; created?: string }>
      }>
    }
  }
}

export async function fetchStatusio(statusioId: string): Promise<StatusPageData> {
  const res = await fetch(`https://api.status.io/1.0/status/${statusioId}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as StatusioResponse
  const { status_overall, status: components, incidents, maintenance } = data.result
  const indicator = statusioCodeToIndicator(status_overall.status_code)

  const activeIncidents: Incident[] = [
    ...incidents.map(i => ({
      id: i._id,
      name: i.name,
      status: i.status,
      incident_updates: i.messages?.map(m => ({ body: m.details, created_at: m.created ?? '' })),
    })),
    ...maintenance.active.map(m => ({
      id: m._id,
      name: m.name,
      status: 'maintenance',
      incident_updates: m.messages?.map(msg => ({
        body: msg.details,
        created_at: msg.created ?? '',
      })),
    })),
  ]

  return {
    status: {
      indicator,
      description: indicator === 'none' ? 'ok' : status_overall.status,
    },
    components: components.map(c => ({
      id: c.id,
      name: c.name,
      status: statusioCodeToComponentStatus(c.status_code),
      group: false,
      group_id: null,
    })),
    incidents: activeIncidents,
  }
}

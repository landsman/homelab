import type { StatusPageData, Incident } from './types'

interface IncidentioStatus {
  ongoing_incidents: Array<{
    id: string
    name: string
    status: string
    updates: Array<{ message: string; created_at: string }>
  }>
  in_progress_maintenances: Array<{
    id: string
    name: string
    updates: Array<{ message: string; created_at: string }>
  }>
  scheduled_maintenances: Array<{
    id: string
    name: string
  }>
}

export async function fetchIncidentio(baseUrl: string): Promise<StatusPageData> {
  const res = await fetch(`${baseUrl}/api/v1/status`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as IncidentioStatus

  const incidents: Incident[] = [
    ...data.ongoing_incidents.map(i => ({
      id: i.id,
      name: i.name,
      status: i.status,
      incident_updates: i.updates.map(u => ({ body: u.message, created_at: u.created_at })),
    })),
    ...data.in_progress_maintenances.map(m => ({
      id: m.id,
      name: m.name,
      status: 'maintenance',
      incident_updates: m.updates.map(u => ({ body: u.message, created_at: u.created_at })),
    })),
  ]

  const indicator =
    data.ongoing_incidents.length > 0
      ? data.ongoing_incidents.some(i => i.status === 'critical')
        ? 'critical'
        : 'minor'
      : data.in_progress_maintenances.length > 0
        ? 'maintenance'
        : 'none'

  return {
    status: {
      indicator,
      description: indicator === 'none' ? 'ok' : `${incidents.length} active event(s)`,
    },
    components: [], // incident.io widget API doesn't seem to provide component list easily in this endpoint
    incidents,
  }
}

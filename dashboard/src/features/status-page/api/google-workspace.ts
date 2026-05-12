import type { StatusPageData } from './types'

interface GoogleIncident {
  id: string
  begin: string
  end?: string
  external_desc: string
  status_impact: string
  affected_products: Array<{ title: string; id: string }>
  updates: Array<{ when: string; text: string; status: string }>
}

const GOOGLE_WORKSPACE_KEY_PRODUCTS: Array<{ id: string; name: string }> = [
  { id: 'prPt2Yra2CbGsbEm9cpC', name: 'Gmail' },
  { id: 'VHNA7p3Z5p3iakj5sA8V', name: 'Google Drive' },
  { id: 'wNHuVFtZEWU5Mmj2eRCK', name: 'Google Docs' },
  { id: 'n5hVexuq1PM9onY9qrmo', name: 'Google Calendar' },
  { id: 'Ht9Vx5PFzDPHYvrnrvSk', name: 'Google Chat' },
  { id: 'sUH4BQXzYXma7NiS94Hi', name: 'Google Meet' },
]

export async function fetchGoogleWorkspace(): Promise<StatusPageData> {
  const res = await fetch('https://www.google.com/appsstatus/dashboard/incidents.json', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const incidents = (await res.json()) as GoogleIncident[]

  const active = incidents.filter(i => !i.end)
  const indicator =
    active.length === 0
      ? 'none'
      : active.some(i => i.status_impact === 'SERVICE_OUTAGE')
        ? 'major'
        : 'minor'

  const affectedIds = new Set<string>()
  for (const inc of active) {
    for (const p of inc.affected_products) {
      affectedIds.add(p.id)
    }
  }

  return {
    status: {
      indicator,
      description: indicator === 'none' ? 'ok' : `${active.length} active incident(s)`,
    },
    components: GOOGLE_WORKSPACE_KEY_PRODUCTS.map(p => ({
      id: p.id,
      name: p.name,
      status: affectedIds.has(p.id) ? 'degraded_performance' : 'operational',
      group: false,
      group_id: null,
    })),
    incidents: active.map(i => ({
      id: i.id,
      name: i.external_desc.split('\n')[0].replace(/\*\*/g, ''),
      status: 'investigating',
      incident_updates: i.updates.map(u => ({ body: u.text, created_at: u.when })),
    })),
  }
}

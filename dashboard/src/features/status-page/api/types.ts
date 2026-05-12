export interface StatusComponent {
  id: string
  name: string
  status: string
  group: boolean
  group_id: string | null
}

export interface IncidentUpdate {
  body: string
  created_at: string
}

export interface Incident {
  id: string
  name: string
  status: string
  incident_updates?: IncidentUpdate[]
}

export interface StatusPageData {
  status: {
    indicator: string
    description: string
  }
  components: StatusComponent[]
  incidents: Incident[]
  version?: string
}

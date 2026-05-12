import { useQuery } from '@tanstack/react-query'
import { match } from 'ts-pattern'
import { SERVICE_TYPE, type Service } from '../services'
import type { StatusPageData, StatusComponent, Incident } from '../api/types'
import { fetchAtlassian } from '../api/atlassian'
import { fetchStatusio } from '../api/statusio'
import { fetchInstatus } from '../api/instatus'
import { fetchGoogleWorkspace } from '../api/google-workspace'
import { fetchIncidentio } from '../api/incidentio'
import { fetchSlack } from '../api/slack'
import { fetchSimpleCheck } from '../api/simple-check'
import { fetchUptimeKuma } from '../api/uptime-kuma'

export type { StatusComponent, Incident, StatusPageData }

export interface UseStatusPageResult {
  data: StatusPageData | null
  loading: boolean
  fetching: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => void
}

async function fetchStatusPage(service: Service): Promise<StatusPageData> {
  try {
    return await match(service)
      .with({ type: SERVICE_TYPE.STATUSIO }, s => fetchStatusio(s.statusioId!))
      .with({ type: SERVICE_TYPE.INSTATUS }, s => fetchInstatus(s.url))
      .with({ type: SERVICE_TYPE.GOOGLE_WORKSPACE }, () => fetchGoogleWorkspace())
      .with({ type: SERVICE_TYPE.INCIDENTIO }, s => fetchIncidentio(s.url))
      .with({ type: SERVICE_TYPE.SLACK }, () => fetchSlack())
      .with({ type: SERVICE_TYPE.SIMPLE_CHECK }, s =>
        fetchSimpleCheck(s.healthCheckUrl ?? s.url, s.versionPath)
      )
      .with({ type: SERVICE_TYPE.UPTIME_KUMA }, s =>
        fetchUptimeKuma(s.url, s.uptimeKumaSlug ?? 'status')
      )
      .with({ type: SERVICE_TYPE.REDIRECT }, () => ({
        status: { indicator: 'none', description: '?' },
        components: [],
        incidents: [],
      }))
      .otherwise(s => fetchAtlassian(s.url))
  } catch (error) {
    console.error(`Failed to fetch status for ${service.name}:`, error)
    throw error
  }
}

export function useStatusPage(service: Service): UseStatusPageResult {
  const { data, isLoading, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['status', service.url],
    queryFn: () => fetchStatusPage(service),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    fetching: isFetching,
    error: error ? (error as Error).message : null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refresh: () => void refetch(),
  }
}

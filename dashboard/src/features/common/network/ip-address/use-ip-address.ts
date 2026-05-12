import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNetworkStatus } from '../use-network-status.ts'

const QUERY_KEYS = {
  MY_IP: ['my-ip'] as const,
  MY_IPV6: ['my-ipv6'] as const,
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

// Multiple providers for better resilience against trackers/adblockers (Firefox ETP)
const IPV4_PROVIDERS = ['https://api4.ipify.org?format=json', 'https://ipv4.icanhazip.com']
const IPV6_PROVIDERS = ['https://api6.ipify.org?format=json', 'https://ipv6.icanhazip.com']

async function fetchIp(providers: string[]): Promise<string> {
  let lastError: Error | null = null

  for (const url of providers) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue

      const text = await response.text()
      try {
        const data = JSON.parse(text) as { ip: string }
        if (data.ip) return data.ip
      } catch {
        const trimmed = text.trim()
        if (trimmed) return trimmed
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError || new Error('Failed to fetch IP from any provider')
}

export function useIpAddress() {
  const queryClient = useQueryClient()
  const { isOnline } = useNetworkStatus()

  useEffect(() => {
    if (isOnline) {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_IP })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_IPV6 })
    }
  }, [isOnline, queryClient])

  const { data: ipv4Raw, isLoading: loadingV4 } = useQuery({
    queryKey: QUERY_KEYS.MY_IP,
    queryFn: () => fetchIp(IPV4_PROVIDERS),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1, // Allow one retry for transient network issues
  })

  const { data: ipv6Raw, isLoading: loadingV6 } = useQuery({
    queryKey: QUERY_KEYS.MY_IPV6,
    queryFn: () => fetchIp(IPV6_PROVIDERS),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  })

  const isRealIpv4 = ipv4Raw != null && !ipv4Raw.includes(':') && !LOOPBACK.has(ipv4Raw)
  const isRealIpv6 = ipv6Raw != null && ipv6Raw.includes(':') && !LOOPBACK.has(ipv6Raw)

  return {
    ipv4: isRealIpv4 ? ipv4Raw : null,
    ipv6: isRealIpv6 ? ipv6Raw : null,
    loadingV4,
    loadingV6,
    isOnline,
  }
}

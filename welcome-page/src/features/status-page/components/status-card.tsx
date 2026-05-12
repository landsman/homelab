import { useStatusPage, type StatusComponent, type Incident } from '../hooks/use-status-page'
import { match, P } from 'ts-pattern'
import { getStatusConfig } from './status-config'
import { formatRelativeTime } from '../../../app/config/format-date'
import { Tooltip } from '../../../app/components/tooltip'
import { SERVICE_TYPE, type Service } from '../services'
import { DragHandle } from './drag-handle'
import { useRef, useCallback, useState, useEffect } from 'react'
import { Image } from '../../../app/components/image'

function RowSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-[var(--border)] flex-1">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center justify-between py-2.5 px-6 gap-3">
          <div className="skeleton h-3 rounded" style={{ width: `${45 + (i % 3) * 15}%` }} />
          <div className="skeleton h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  )
}

function ErrorCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center gap-3 fade-in">
      <span className="text-red-400 text-xs font-medium">⚠ fetch failed</span>
      <span className="text-[10px] text-[var(--text-muted)] line-clamp-2 max-w-[200px]">
        {error}
      </span>
      <button
        onClick={onRetry}
        className="mt-1 text-[10px] text-[var(--text-dim)] hover:text-slate-200 border border-[var(--border)] hover:border-[var(--dim)] px-3 py-1.5 rounded transition-colors"
      >
        retry
      </button>
    </div>
  )
}

function StatusDot({ status, pulse = false }: { status: string; pulse?: boolean }) {
  const cfg = getStatusConfig(status)
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${pulse && status !== 'operational' && status !== 'none' ? 'status-pulse' : ''}`}
      style={{ backgroundColor: cfg.dot, color: cfg.dot }}
    />
  )
}

function StatusBadge({ indicator, description }: { indicator: string; description?: string }) {
  const cfg = getStatusConfig(indicator)
  const label = description ?? (cfg.label === 'Operational' ? 'ok' : cfg.label)
  return (
    <Tooltip content={label} className="shrink-0 max-w-[140px]">
      <span
        className="inline-flex items-center gap-1.5 px-0 py-1 text-xs font-medium tracking-wide w-full justify-end"
        style={{ color: cfg.color }}
      >
        <StatusDot status={indicator} pulse />
        <span className="truncate">{label}</span>
      </span>
    </Tooltip>
  )
}

export interface StatusCardProps {
  service: Service
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function StatusCard({ service, dragHandleProps }: StatusCardProps) {
  const { name, url, hiddenComponents = [] } = service
  const iconSlug = service.icon ?? name.toLowerCase()
  const { data, loading, fetching, error, lastUpdated, refresh } = useStatusPage(service)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    refresh()
    // Minimum 1s animation to see it happening
    setTimeout(() => setIsRefreshing(false), 1000)
  }, [refresh])

  const lastRefreshTime = useRef<number>(0)
  const handleMouseEnter = useCallback(() => {
    if (service.type === SERVICE_TYPE.REDIRECT) return
    const now = Date.now()
    if (now - lastRefreshTime.current >= 10000) {
      lastRefreshTime.current = now
      handleRefresh()
    }
  }, [handleRefresh, service.type])

  const status = data?.status
  const components = data?.components ?? []
  const incidents = data?.incidents ?? []
  const filteredComponents = components.filter(
    (c: StatusComponent) => !hiddenComponents.includes(c.name)
  )

  const visibleComponents = filteredComponents.filter((c: StatusComponent) => !c.group).slice(0, 10)

  const activeIncidents = incidents.filter(
    (i: Incident) => i.status !== 'resolved' && i.status !== 'postmortem'
  )

  return (
    <div
      onMouseEnter={handleMouseEnter}
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col fade-in group/card transition-all duration-300 relative overflow-hidden ${
        fetching || isRefreshing ? 'animate-loading-border border-transparent' : ''
      }`}
    >
      {(fetching || isRefreshing) && <div className="loading-line" />}
      <div className="flex flex-col h-full bg-[var(--card)] rounded-[11px] m-[1.5px] relative z-10">
        {/* Header */}
        <div
          className={`flex items-center gap-3 px-6 py-4 border-b border-[var(--border)] bg-[var(--card)] transition-colors ${fetching || isRefreshing ? 'bg-blue-500/5' : ''}`}
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 group min-w-0 flex-1"
            title={`Open ${name} status page`}
          >
            <Image
              src={`/icons/services/${iconSlug}.svg`}
              width={20}
              height={20}
              alt=""
              className="shrink-0"
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <Tooltip content={name} className="min-w-0" showOnlyOnOverflow>
              <span className="text-sm font-semibold tracking-widest text-slate-300 group-hover/tooltip:text-slate-100 transition-colors truncate">
                {name}
              </span>
            </Tooltip>
            {data?.version && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                v{data.version}
              </span>
            )}
            <Image
              src="/icons/ui/external-link.svg"
              alt=""
              className="w-[11px] h-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-dim)] transition-colors shrink-0 opacity-50 invert"
            />
          </a>
          <div className="shrink-0 relative flex items-center justify-end overflow-visible min-w-[80px]">
            <div className="group-hover/card:invisible transition-opacity duration-200">
              {status ? (
                <StatusBadge indicator={status.indicator} description={status.description} />
              ) : (
                <div className="skeleton h-3 w-12 rounded" />
              )}
            </div>
            {dragHandleProps && (
              <div className="absolute inset-0 flex items-center justify-end z-20 pointer-events-none opacity-0 group-hover/card:opacity-100 group-hover/card:pointer-events-auto transition-opacity duration-200 overflow-visible">
                <DragHandle {...dragHandleProps} isAbsolute={false} placement="bottom" />
              </div>
            )}
          </div>
        </div>

        {/* Active Incidents */}
        {activeIncidents.length > 0 && (
          <div className="px-6 py-3 border-b border-[var(--border)] bg-red-950/20">
            {activeIncidents.map((incident: Incident) => (
              <div key={incident.id} className="flex flex-col gap-0.5">
                <span className="text-xs text-red-400 font-medium">⚡ {incident.name}</span>
                {incident.incident_updates?.[0]?.body && (
                  <span className="text-xs text-[var(--text-dim)] line-clamp-2">
                    {incident.incident_updates[0].body}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Components */}
        {match({ loading, data, error })
          .with({ loading: true, data: P.nullish }, () => <RowSkeleton />)
          .with({ error: P.string, data: P.nullish }, ({ error }) => (
            <ErrorCard error={error} onRetry={refresh} />
          ))
          .otherwise(() => (
            <div className="flex flex-col divide-y divide-[var(--border)] flex-1">
              {service.type === SERVICE_TYPE.REDIRECT && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
                  <span className="text-xs text-[var(--text-dim)]">
                    API is not accessible for this service.
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--text-muted)] hover:text-slate-200 underline underline-offset-4 decoration-slate-500/30 hover:decoration-slate-200 transition-all"
                  >
                    Please visit the status page directly.
                  </a>
                </div>
              )}
              {service.type === SERVICE_TYPE.SIMPLE_CHECK && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
                  <span className="text-xs text-[var(--text-dim)]">
                    Service is{' '}
                    {status?.indicator === 'none' ? status.description : 'not responding'}.
                  </span>
                  {data?.version ? (
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      version v{data.version}
                    </span>
                  ) : (
                    service.versionPath && (
                      <span className="text-[10px] text-red-400/50 font-mono italic">
                        version unavailable (CORS)
                      </span>
                    )
                  )}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--text-muted)] hover:text-slate-200 underline underline-offset-4 decoration-slate-500/30 hover:decoration-slate-200 transition-all"
                  >
                    Visit service
                  </a>
                </div>
              )}
              {visibleComponents.map((component: StatusComponent) => {
                const cfg = getStatusConfig(component.status)
                const label = cfg.label === 'Operational' ? 'ok' : cfg.label
                return (
                  <div
                    key={component.id}
                    className="flex items-center justify-between py-2 px-6 hover:bg-white/5 group/row transition-colors gap-3 min-w-0"
                  >
                    <Tooltip
                      content={component.name}
                      className="flex-1 min-w-0"
                      placement="bottom"
                      showOnlyOnOverflow
                    >
                      <span className="text-xs text-[var(--text-dim)] group-hover/row:text-slate-200 truncate w-full text-left transition-colors">
                        {component.name}
                      </span>
                    </Tooltip>
                    <span
                      className="text-xs font-medium shrink-0 flex items-center gap-1.5 group-hover/row:brightness-125 transition-all"
                      style={{ color: cfg.color }}
                    >
                      <StatusDot status={component.status} />
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}

        {/* Footer */}
        {service.type !== SERVICE_TYPE.REDIRECT && (
          <div className="flex items-center justify-between px-6 border-t border-[var(--border)] mt-auto rounded-b-xl bg-[var(--card)]">
            <div className="flex items-center h-9">
              {lastUpdated ? (
                <span className="text-[10px] text-slate-500 italic">
                  {formatRelativeTime(lastUpdated)}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 italic">fetching...</span>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-[var(--text-dim)] transition-colors py-3 px-1 -mr-1"
              title="Refresh now"
              aria-label="Refresh"
            >
              <Image
                src="/icons/ui/refresh.svg"
                alt=""
                className={`w-[11px] h-[11px] opacity-40 invert ${fetching || isRefreshing ? 'animate-spin' : ''}`}
              />
              refresh
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

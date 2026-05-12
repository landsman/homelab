import { match } from 'ts-pattern'

export interface StatusStyle {
  label: string
  color: string
  bg?: string
  dot: string
}

export const STATUS_CONFIG: Record<string, StatusStyle> = {
  // Page-level indicator
  none: { label: 'Operational', color: 'var(--green)', bg: 'rgba(34,197,94,0.1)', dot: '#22c55e' },
  minor: {
    label: 'Minor Issues',
    color: 'var(--yellow)',
    bg: 'rgba(234,179,8,0.1)',
    dot: '#eab308',
  },
  major: {
    label: 'Major Outage',
    color: 'var(--orange)',
    bg: 'rgba(249,115,22,0.1)',
    dot: '#f97316',
  },
  critical: { label: 'Critical', color: 'var(--red)', bg: 'rgba(239,68,68,0.1)', dot: '#ef4444' },
  maintenance: {
    label: 'Maintenance',
    color: 'var(--blue)',
    bg: 'rgba(59,130,246,0.1)',
    dot: '#3b82f6',
  },
  // Component-level status
  operational: { label: 'Operational', color: 'var(--green)', dot: '#22c55e' },
  degraded_performance: { label: 'Degraded', color: 'var(--yellow)', dot: '#eab308' },
  partial_outage: { label: 'Partial Outage', color: 'var(--orange)', dot: '#f97316' },
  major_outage: { label: 'Major Outage', color: 'var(--red)', dot: '#ef4444' },
  under_maintenance: { label: 'Maintenance', color: 'var(--blue)', dot: '#3b82f6' },
}

const FALLBACK: StatusStyle = {
  label: 'Unknown',
  color: 'var(--gray)',
  bg: 'rgba(107,114,128,0.1)',
  dot: '#6b7280',
}

export function getStatusConfig(indicator: string | undefined): StatusStyle {
  if (!indicator) return FALLBACK

  return match(indicator as string)
    .when(
      i => i in STATUS_CONFIG,
      i => STATUS_CONFIG[i]
    )
    .otherwise(i => ({ ...FALLBACK, label: i }))
}

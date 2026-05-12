import { formatDistanceToNowStrict } from 'date-fns'
import type { Config } from './config-provider'

export function formatDate(date: Date, config: Config): string {
  return date.toLocaleDateString(config.locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: config.timezone,
  })
}

export function formatDateShort(date: Date, config: Config): string {
  return date.toLocaleDateString(config.locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: config.timezone,
  })
}

export function formatTime(date: Date, config: Config): string {
  return date.toLocaleTimeString(config.locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: config.timezone,
  })
}

export function formatRelativeTime(date: Date): string {
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffInSeconds <= 1) {
    return 'now'
  }
  if (diffInSeconds >= 2 && diffInSeconds <= 10) {
    return 'a few seconds ago'
  }
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

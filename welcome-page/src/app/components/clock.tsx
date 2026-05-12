import { useState, useEffect } from 'react'
import { useConfig } from '../config/config-provider'
import { formatDate, formatDateShort } from '../config/format-date'
import { Tooltip } from './tooltip'

interface HeaderClockProps {
  onSettingsClick: () => void
  variant?: 'full' | 'short'
}

export function Clock({ onSettingsClick, variant = 'full' }: HeaderClockProps) {
  const config = useConfig()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const dateStr = variant === 'full' ? formatDate(now, config) : formatDateShort(now, config)

  const textClasses =
    variant === 'full'
      ? { date: 'text-xs', timezone: 'text-[11px]' }
      : { date: 'text-[9px]', timezone: 'text-[8px]' }

  return (
    <Tooltip content="Settings — change timezone, locale and other preferences" placement="bottom">
      <button
        onClick={onSettingsClick}
        className="flex flex-col items-end group"
        aria-label="Open settings"
      >
        <div
          className={`${textClasses.date} text-(--text-dim) tracking-wide group-hover:text-slate-300 transition-colors`}
        >
          {dateStr}
        </div>
        <div
          className={`${textClasses.timezone} text-(--text-muted) group-hover:text-(--text-dim) transition-colors mt-0.5`}
        >
          {config.timezone}
        </div>
      </button>
    </Tooltip>
  )
}

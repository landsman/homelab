import { useState, useEffect } from 'react'
import { useConfig } from '../config-provider'
import { LOCALES } from '../i18n.ts'

const ALL_TIMEZONES: string[] = Intl.supportedValuesOf('timeZone')

interface ConfigModalProps {
  onClose: () => void
}

export function ConfigModal({ onClose }: ConfigModalProps) {
  const { locale, timezone, setLocale, setTimezone } = useConfig()
  const [tzInput, setTzInput] = useState(timezone)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleTimezoneBlur = () => {
    if (ALL_TIMEZONES.includes(tzInput)) {
      setTimezone(tzInput)
    } else {
      setTzInput(timezone) // revert to last valid value
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <span className="text-xs font-semibold tracking-widest uppercase text-slate-300">
            Settings
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer text-[var(--text-muted)] hover:text-slate-300 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path
                d="M13 1L1 13M1 1l12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Locale */}
          <label className="flex flex-col gap-2">
            <span className="text-[10px] tracking-widest uppercase text-[var(--text-muted)]">
              Locale
            </span>
            <select
              value={locale}
              onChange={e => setLocale(e.target.value)}
              className="bg-[var(--terminal-bg,#080c12)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[var(--dim)] transition-colors"
            >
              {LOCALES.map(l => (
                <option key={l.value} value={l.value}>
                  {l.label} ({l.value})
                </option>
              ))}
            </select>
          </label>

          {/* Timezone */}
          <label className="flex flex-col gap-2">
            <span className="text-[10px] tracking-widest uppercase text-[var(--text-muted)]">
              Timezone
            </span>
            <input
              list="tz-list"
              value={tzInput}
              onChange={e => setTzInput(e.target.value)}
              onBlur={handleTimezoneBlur}
              placeholder="e.g. Europe/Warsaw"
              className="bg-[var(--terminal-bg,#080c12)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[var(--dim)] transition-colors placeholder:text-[var(--text-muted)]"
            />
            <datalist id="tz-list">
              {ALL_TIMEZONES.map(tz => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            {tzInput !== timezone && !ALL_TIMEZONES.includes(tzInput) && (
              <span className="text-[10px] text-red-400">invalid timezone</span>
            )}
          </label>

          {/* Preview */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
            <span className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase block mb-1">
              Preview
            </span>
            <span className="text-xs text-slate-300">
              {new Date().toLocaleDateString(locale, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: timezone,
              })}
              {' · '}
              {new Date().toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: timezone,
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

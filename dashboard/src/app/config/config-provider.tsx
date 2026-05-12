import { createContext, useContext, useState, type ReactNode } from 'react'

const COOKIE_LOCALE = 'hl_locale'
const COOKIE_TIMEZONE = 'hl_timezone'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
}

const browserLocale = navigator.language || 'en-US'
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export interface Config {
  locale: string
  timezone: string
}

interface ConfigContextValue extends Config {
  setLocale: (locale: string) => void
  setTimezone: (timezone: string) => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(getCookie(COOKIE_LOCALE) ?? browserLocale)
  const [timezone, setTimezoneState] = useState(getCookie(COOKIE_TIMEZONE) ?? browserTimezone)

  const setLocale = (value: string) => {
    setCookie(COOKIE_LOCALE, value)
    setLocaleState(value)
  }

  const setTimezone = (value: string) => {
    setCookie(COOKIE_TIMEZONE, value)
    setTimezoneState(value)
  }

  return (
    <ConfigContext.Provider value={{ locale, timezone, setLocale, setTimezone }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}

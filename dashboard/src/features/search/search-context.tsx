import { createContext, useContext, useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'

interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  const pathname = useRouterState({ select: s => s.location.pathname })

  // A query typed on one page means nothing on the other — drop it on navigation.
  useEffect(() => setQuery(''), [pathname])

  return <SearchContext value={{ query, setQuery }}>{children}</SearchContext>
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch must be used inside SearchProvider')
  return ctx
}

import { useMemo } from 'react'
import { HOME_CATEGORIES } from '../data/services.ts'
import { HomeCategory } from '../data/services.types.ts'

/** Keeps services whose name matches the query; a category left with none drops out. */
export function filterCategories(categories: HomeCategory[], query: string): HomeCategory[] {
  const q = query.trim().toLowerCase()
  if (!q) return categories
  return categories
    .map(c => ({ ...c, services: c.services.filter(s => s.name.toLowerCase().includes(q)) }))
    .filter(c => c.services.length > 0)
}

export function useFilteredCategories(query: string): HomeCategory[] {
  return useMemo(() => filterCategories(HOME_CATEGORIES, query), [query])
}

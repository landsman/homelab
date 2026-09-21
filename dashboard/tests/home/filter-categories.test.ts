import { describe, expect, it } from 'vitest'
import { filterCategories } from '@/features/home/hooks/use-filtered-categories'
import type { HomeCategory } from '@/features/home/data/services.types'

const CATEGORIES: HomeCategory[] = [
  {
    label: 'Free time',
    services: [
      { name: 'Reddit', url: 'https://reddit.com' },
      { name: 'Bluesky', url: 'https://bsky.app' },
    ],
  },
  { label: 'LLM', services: [{ name: 'Claude', url: 'https://claude.ai' }] },
]

describe('filterCategories', () => {
  it('returns everything for an empty or blank query', () => {
    expect(filterCategories(CATEGORIES, '')).toBe(CATEGORIES)
    expect(filterCategories(CATEGORIES, '   ')).toBe(CATEGORIES)
  })

  it('matches case-insensitively on a substring of the name', () => {
    expect(filterCategories(CATEGORIES, 'DDI')).toEqual([
      { label: 'Free time', services: [{ name: 'Reddit', url: 'https://reddit.com' }] },
    ])
  })

  it('drops a category left without a match', () => {
    const result = filterCategories(CATEGORIES, 'claude')
    expect(result.map(c => c.label)).toEqual(['LLM'])
  })

  it('returns nothing when no service matches', () => {
    expect(filterCategories(CATEGORIES, 'nope')).toEqual([])
  })
})

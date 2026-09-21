import { useMemo } from 'react'
import { ServiceCard } from './ui/service-card.tsx'
import { ServiceHotkey } from './ui/service-hot-key.tsx'
import { HOME_CATEGORIES } from './data/services.ts'
import { SearchBar } from '../search/search-bar'

interface HomePageProps {
  query: string
  onQueryChange: (value: string) => void
}

export function HomePage({ query, onQueryChange }: HomePageProps) {
  const servicesWithShortcuts = HOME_CATEGORIES.flatMap(c => c.services).filter(s => s.shortcut)
  const q = query.trim().toLowerCase()

  const categories = useMemo(() => {
    if (!q) return HOME_CATEGORIES
    return HOME_CATEGORIES.map(c => ({
      ...c,
      services: c.services.filter(s => s.name.toLowerCase().includes(q)),
    })).filter(c => c.services.length > 0)
  }, [q])

  return (
    <div className="flex flex-col gap-10 fade-in">
      {servicesWithShortcuts.map(s => (
        <ServiceHotkey key={s.shortcut} service={s} />
      ))}

      <div className="md:hidden">
        <SearchBar query={query} onChange={onQueryChange} />
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-8 text-center text-xs text-[var(--text-muted)]">
          No matching services
        </div>
      ) : (
        categories.map(category => (
          <section key={category.label}>
            <h2 className="text-[10px] text-(--text-muted) tracking-[0.2em] uppercase mb-4">
              {category.label}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(106px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(126px,1fr))]">
              {category.services.map(service => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

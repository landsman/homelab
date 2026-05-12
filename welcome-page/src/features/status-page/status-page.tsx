import { useMemo } from 'react'
import { SERVICES, type ServiceSection, SERVICE_SECTION } from './services'
import { usePersistence } from './hooks/use-persistence'
import { SectionGroup } from './components/section-group'
import { SearchBar } from '../search/search-bar'

const SECTION_ORDER: ServiceSection[] = [SERVICE_SECTION.EXTERNAL, SERVICE_SECTION.HOMELAB]

interface StatusPageProps {
  query: string
  onQueryChange: (value: string) => void
}

export function StatusPage({ query, onQueryChange }: StatusPageProps) {
  const { order, setOrder, collapsed, toggleCollapsed } = usePersistence()

  const q = query.trim().toLowerCase()

  const bySection = useMemo(() => {
    return SECTION_ORDER.map(section => ({
      section,
      services: SERVICES.filter(s => (s.section ?? SERVICE_SECTION.EXTERNAL) === section),
    }))
  }, [])

  let offset = 0
  return (
    <div className="flex flex-col gap-6">
      <div className="md:hidden">
        <SearchBar query={query} onChange={onQueryChange} />
      </div>

      {bySection.map(({ section, services }) => {
        const group = (
          <SectionGroup
            key={section}
            section={section}
            initialServices={services}
            animationOffset={offset}
            query={q}
            savedOrder={order[section] ?? []}
            isCollapsed={collapsed.has(section)}
            onToggleCollapsed={toggleCollapsed}
            onOrderChange={setOrder}
          />
        )
        offset += services.length
        return group
      })}
    </div>
  )
}

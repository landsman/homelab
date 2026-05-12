import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import type { Service, ServiceSection } from '../services'
import { SERVICE_SECTION } from '../services'
import { StatusCard } from './status-card'
import { Image } from '../../../app/components/image'
import { SortableCard } from './sortable-card'

const SECTION_LABELS: Record<ServiceSection, string> = {
  [SERVICE_SECTION.EXTERNAL]: 'External Services',
  [SERVICE_SECTION.HOMELAB]: 'Homelab',
}

function applyOrder(services: Service[], savedOrder: string[]): Service[] {
  if (savedOrder.length === 0) return services
  const map = new Map(services.map(s => [s.name, s]))
  const ordered = savedOrder.flatMap(name => {
    const s = map.get(name)
    return s ? [s] : []
  })
  // append any new services not yet in saved order
  const orderedNames = new Set(savedOrder)
  for (const s of services) {
    if (!orderedNames.has(s.name)) ordered.push(s)
  }
  return ordered
}

interface SectionGroupProps {
  section: ServiceSection
  initialServices: Service[]
  animationOffset: number
  query: string
  savedOrder: string[]
  isCollapsed: boolean
  onToggleCollapsed: (section: ServiceSection) => void
  onOrderChange: (section: ServiceSection, newOrder: string[]) => void
}

export function SectionGroup({
  section,
  initialServices,
  animationOffset,
  query,
  savedOrder,
  isCollapsed,
  onToggleCollapsed,
  onOrderChange,
}: SectionGroupProps) {
  const [localServices, setLocalServices] = useState(() => applyOrder(initialServices, savedOrder))
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const visible = useMemo(() => {
    if (!query) return localServices
    return localServices.filter(
      s =>
        s.name.toLowerCase().includes(query) ||
        s.keywords?.some(k => k.toLowerCase().includes(query))
    )
  }, [localServices, query])

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = localServices.findIndex(s => s.name === active.id)
    const newIndex = localServices.findIndex(s => s.name === over.id)
    const next = arrayMove(localServices, oldIndex, newIndex)
    setLocalServices(next)
    onOrderChange(
      section,
      next.map(s => s.name)
    )
  }

  const activeService = activeId ? localServices.find(s => s.name === activeId) : null
  const headingId = `section-heading-${section}`
  const regionId = `section-region-${section}`

  return (
    <div className="flex flex-col gap-4">
      <button
        id={headingId}
        onClick={() => onToggleCollapsed(section)}
        aria-expanded={!isCollapsed}
        aria-controls={regionId}
        title={
          isCollapsed ? `Expand ${SECTION_LABELS[section]}` : `Collapse ${SECTION_LABELS[section]}`
        }
        className={`relative flex items-center w-full group py-3 pl-10 pr-3 rounded-lg transition-all cursor-pointer ${
          isCollapsed
            ? 'border border-[var(--dim)] bg-gradient-to-b from-[#131f30] to-[#0d1520] shadow-[0_2px_0_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)] hover:from-[#172438] hover:to-[#111c2d] active:shadow-none active:translate-y-px'
            : 'hover:bg-white/5'
        }`}
      >
        <Image
          src="/icons/ui/chevron-down.svg"
          alt=""
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-[13px] h-[13px] transition-transform duration-200 shrink-0 opacity-50 invert ${isCollapsed ? '-rotate-90' : ''}`}
        />
        <span className="text-xs font-semibold tracking-widest uppercase text-[var(--text-dim)] group-hover:text-slate-300 transition-colors">
          {SECTION_LABELS[section]}
        </span>
        <span className="text-xs text-[var(--text-muted)] ml-2">({visible.length})</span>
      </button>

      {!isCollapsed && (
        <div id={regionId} role="region" aria-labelledby={headingId}>
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-8 text-center text-xs text-[var(--text-muted)]">
              {query ? 'No matching services' : 'No services configured yet'}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localServices.map(s => s.name)}
                strategy={rectSortingStrategy}
              >
                <div className="columns-[320px] gap-4">
                  {visible.map((service, i) => (
                    <SortableCard
                      key={service.name}
                      service={service}
                      animationDelay={(animationOffset + i) * 60}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeService && (
                  <div className="rotate-1 scale-105 opacity-90 shadow-2xl">
                    <StatusCard service={activeService} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}

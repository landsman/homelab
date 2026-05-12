import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Service } from '../services'
import { StatusCard } from './status-card'

interface SortableCardProps {
  service: Service
  animationDelay: number
}

export function SortableCard({ service, animationDelay }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.name,
  })

  return (
    <div
      ref={setNodeRef}
      className="break-inside-avoid pb-4 relative group/card hover:z-50 select-none"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <StatusCard service={service} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

import { Tooltip } from '../../../app/components/tooltip'
import { Image } from '../../../app/components/image'

interface DragHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  isAbsolute?: boolean
  className?: string
  placement?: 'top' | 'bottom'
}

export function DragHandle({
  isAbsolute = false,
  className = '',
  placement = 'top',
  ...props
}: DragHandleProps) {
  return (
    <Tooltip
      content="Drag to reorder"
      placement={placement}
      className={`${isAbsolute ? 'absolute top-2 right-2' : ''} ${className}`}
    >
      <div
        {...props}
        className="cursor-grab active:cursor-grabbing p-1.5 rounded-md touch-none text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-white/10 transition-colors bg-[var(--card)] pointer-events-auto"
      >
        <Image src="/icons/ui/drag-handle.svg" alt="" className="w-4 h-4 opacity-70 invert" />
      </div>
    </Tooltip>
  )
}

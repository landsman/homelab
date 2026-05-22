import { cn } from '../../../app/lib/cn'
import { useShiftKey } from './use-shift-key'

interface HotKeyProps {
  children: React.ReactNode
  className?: string
  /** Whether holding Shift "arms" this hotkey — drives the pop-up highlight. Default true. */
  requiresShift?: boolean
}

export function HotKey({ children, className, requiresShift = true }: HotKeyProps) {
  const shiftDown = useShiftKey()
  const active = requiresShift && shiftDown

  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center font-mono leading-none rounded px-1.5 py-0.5 transition-all duration-150 ease-out will-change-transform',
        active
          ? 'bg-white/95 text-slate-900 border border-slate-400 shadow-[0_10px_24px_-4px_rgba(0,0,0,0.7),0_4px_8px_-2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.15)] scale-125 -translate-y-0.5'
          : 'text-(--text-muted) border border-transparent [text-shadow:0_1px_1px_rgba(0,0,0,1)]',
        className
      )}
    >
      {children}
    </kbd>
  )
}

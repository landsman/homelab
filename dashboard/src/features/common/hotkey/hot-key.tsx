import { cn } from '../../../app/lib/cn'
import { useShiftKey } from './use-shift-key'

interface HotKeyProps {
  children: React.ReactNode
  className?: string
  /** Whether holding Shift "arms" this hotkey — drives the pop-up highlight. Default true. */
  requiresShift?: boolean
  /** Force the popped/active styling regardless of Shift (e.g. while the hotkey is firing). */
  forceActive?: boolean
}

export function HotKey({
  children,
  className,
  requiresShift = true,
  forceActive = false,
}: HotKeyProps) {
  const shiftDown = useShiftKey()
  const active = forceActive || (requiresShift && shiftDown)

  return (
    <kbd
      className={cn(
        // Note: transform-origin is intentionally not set here — callers should pick one
        // that matches how the kbd is positioned (e.g. origin-top-right for absolute top-right).
        'inline-flex items-center justify-center font-mono leading-none rounded px-1.5 py-0.5 will-change-transform transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        active
          ? 'bg-white/95 text-slate-900 border border-slate-400 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.65),0_3px_6px_-2px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.15)] scale-[1.15]'
          : 'text-(--text-muted) border border-transparent [text-shadow:0_1px_1px_rgba(0,0,0,1)]',
        className
      )}
    >
      {children}
    </kbd>
  )
}

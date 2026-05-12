import { cn } from '../../../app/lib/cn'

interface HotKeyProps {
  children: React.ReactNode
  className?: string
}

export function HotKey({ children, className }: HotKeyProps) {
  return (
    <kbd
      className={cn(
        'text-(--text-muted) font-mono leading-none [text-shadow:0_1px_1px_rgba(0,0,0,1)]',
        className
      )}
    >
      {children}
    </kbd>
  )
}

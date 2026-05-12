import { useState, useRef } from 'react'

type Placement = 'top' | 'bottom'

interface TooltipProps {
  content: string
  placement?: Placement
  children: React.ReactNode
  className?: string
  showOnlyOnOverflow?: boolean
}

export function Tooltip({
  content,
  placement = 'top',
  children,
  className = '',
  showOnlyOnOverflow = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [alignment, setAlignment] = useState<'left' | 'right'>('left')
  const containerRef = useRef<HTMLSpanElement>(null)

  const handleMouseEnter = () => {
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const spaceOnRight = window.innerWidth - rect.right
      const spaceOnLeft = rect.left

      // If less than 150px on right, align to right
      if (spaceOnRight < 150 && spaceOnLeft > spaceOnRight) {
        setAlignment('right')
      } else {
        setAlignment('left')
      }
    }

    if (!showOnlyOnOverflow) {
      setIsVisible(true)
      return
    }

    if (container) {
      // Find the first child that might be overflowing (usually the text span)
      const target = container.firstElementChild as HTMLElement
      if (target) {
        const isOverflowing = target.scrollWidth > target.clientWidth
        setIsVisible(isOverflowing)
      }
    }
  }

  return (
    <span
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsVisible(false)}
      className={`relative group/tooltip flex items-center justify-start ${className}`}
    >
      {children}
      {isVisible && (
        <span
          className={`pointer-events-none absolute z-[100] flex flex-col ${
            alignment === 'left' ? 'items-start left-0' : 'items-end right-0'
          } ${placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          {placement === 'bottom' && (
            <span
              className={`${alignment === 'left' ? 'ml-3' : 'mr-3'} mb-px w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-black`}
            />
          )}
          <span className="px-2.5 py-1.5 rounded-md bg-black text-white text-xs whitespace-normal sm:whitespace-nowrap max-w-[200px] sm:max-w-none shadow-lg border border-white/10">
            {content}
          </span>
          {placement === 'top' && (
            <span
              className={`${alignment === 'left' ? 'ml-3' : 'mr-3'} mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black`}
            />
          )}
        </span>
      )}
    </span>
  )
}

import { useEffect, RefObject } from 'react'
import { Hotkey } from '../common/hotkey/hotkey.ts'

/**
 * Focuses the given input when the user presses Space (only when no other input is focused).
 * Pass `active: false` to disable the listener (e.g. on pages where the search bar is not visible).
 */
export function useSearchFocus(ref: RefObject<HTMLInputElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable)
        return
      if (e.code === Hotkey.SPACE) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ref, active])
}

import { useEffect, useState } from 'react'

type Listener = (down: boolean) => void

const listeners = new Set<Listener>()
let shiftDown = false
let active = false
let initialized = false

function isInputFocused(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function recompute() {
  const next = shiftDown && !isInputFocused()
  if (next === active) return
  active = next
  for (const listener of listeners) listener(next)
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('keydown', e => {
    if (e.key === 'Shift' && !shiftDown) {
      shiftDown = true
      recompute()
    }
  })
  window.addEventListener('keyup', e => {
    if (e.key === 'Shift' && shiftDown) {
      shiftDown = false
      recompute()
    }
  })
  window.addEventListener('blur', () => {
    shiftDown = false
    recompute()
  })
  // Suppress / restore the visual pop as focus moves in and out of inputs.
  window.addEventListener('focusin', recompute)
  window.addEventListener('focusout', recompute)
}

/** Subscribe to the global Shift-key down state — suppressed while an input is focused. */
export function useShiftKey(): boolean {
  const [down, setDown] = useState(active)
  useEffect(() => {
    init()
    listeners.add(setDown)
    setDown(active)
    return () => {
      listeners.delete(setDown)
    }
  }, [])
  return down
}

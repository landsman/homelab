import { useSyncExternalStore } from 'react'

const subscribers = new Set<() => void>()
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
  for (const cb of subscribers) cb()
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  // Listeners are intentionally not removed: this is an SPA-lifetime singleton, so the
  // overhead of a teardown path that never runs would just be dead code. If we ever
  // tear the dashboard down inside a host page, expose a reset hook here.
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
  window.addEventListener('focusin', recompute)
  window.addEventListener('focusout', recompute)
}

function subscribe(cb: () => void): () => void {
  init()
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

function getSnapshot(): boolean {
  return active
}

/** Subscribe to the global Shift-key down state — suppressed while an input is focused. */
export function useShiftKey(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

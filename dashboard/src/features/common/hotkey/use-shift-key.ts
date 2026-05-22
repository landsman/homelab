import { useEffect, useState } from 'react'

type Listener = (down: boolean) => void

const listeners = new Set<Listener>()
let isDown = false
let initialized = false

function notify(next: boolean) {
  if (next === isDown) return
  isDown = next
  for (const listener of listeners) listener(next)
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('keydown', e => {
    if (e.key === 'Shift') notify(true)
  })
  window.addEventListener('keyup', e => {
    if (e.key === 'Shift') notify(false)
  })
  window.addEventListener('blur', () => notify(false))
}

/** Subscribe to the global Shift-key down state. */
export function useShiftKey(): boolean {
  const [down, setDown] = useState(isDown)
  useEffect(() => {
    init()
    listeners.add(setDown)
    setDown(isDown)
    return () => {
      listeners.delete(setDown)
    }
  }, [])
  return down
}

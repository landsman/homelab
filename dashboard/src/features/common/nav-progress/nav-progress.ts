import { useEffect, useState } from 'react'

export interface NavState {
  active: boolean
  serviceName: string | null
}

type Listener = (s: NavState) => void

const SAFETY_TIMEOUT_MS = 8000

let state: NavState = { active: false, serviceName: null }
const listeners = new Set<Listener>()
let safetyTimer: ReturnType<typeof setTimeout> | null = null
let listenersInstalled = false

function notify() {
  for (const l of listeners) l(state)
}

function installWindowListeners() {
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true
  // BFCache restore brings the page back with our in-memory state intact — reset so a
  // stale "loading" doesn't linger after the user navigates back.
  window.addEventListener('pageshow', e => {
    if ((e as PageTransitionEvent).persisted) finishNavigation()
  })
  // If the page is hidden (user switched tab) then comes back, also clear — the original
  // navigation either succeeded (different URL, would have unloaded) or never started.
  window.addEventListener('pagehide', e => {
    if (!(e as PageTransitionEvent).persisted) finishNavigation()
  })
}

/** Mark that a navigation is in flight — drives the top bar and the kbd "fired" pulse. */
export function startNavigation(serviceName: string | null = null) {
  installWindowListeners()
  state = { active: true, serviceName }
  notify()
  if (safetyTimer) clearTimeout(safetyTimer)
  // Auto-reset if the page never actually unloads (popup blocked, download link, etc.)
  safetyTimer = setTimeout(finishNavigation, SAFETY_TIMEOUT_MS)
}

/** Clear nav state — call when a navigation completes or is cancelled. */
export function finishNavigation() {
  if (safetyTimer) {
    clearTimeout(safetyTimer)
    safetyTimer = null
  }
  if (!state.active && state.serviceName === null) return
  state = { active: false, serviceName: null }
  notify()
}

/** Subscribe to the global nav-progress state. */
export function useNavProgress(): NavState {
  const [s, set] = useState(state)
  useEffect(() => {
    listeners.add(set)
    set(state)
    return () => {
      listeners.delete(set)
    }
  }, [])
  return s
}

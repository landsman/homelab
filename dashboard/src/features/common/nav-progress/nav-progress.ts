import { useSyncExternalStore } from 'react'

export interface NavState {
  active: boolean
  serviceName: string | null
}

const SAFETY_TIMEOUT_MS = 8000

let state: NavState = { active: false, serviceName: null }
const subscribers = new Set<() => void>()
let safetyTimer: ReturnType<typeof setTimeout> | null = null
let listenersInstalled = false

function notify() {
  for (const cb of subscribers) cb()
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

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

function getSnapshot(): NavState {
  return state
}

/** Subscribe to the global nav-progress state. */
export function useNavProgress(): NavState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

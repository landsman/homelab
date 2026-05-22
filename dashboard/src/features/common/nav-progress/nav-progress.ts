import { useEffect, useState } from 'react'

export interface NavState {
  active: boolean
  serviceName: string | null
}

type Listener = (s: NavState) => void

let state: NavState = { active: false, serviceName: null }
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l(state)
}

/** Mark that a navigation is in flight — drives the top bar and the kbd "fired" pulse. */
export function startNavigation(serviceName: string | null = null) {
  state = { active: true, serviceName }
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

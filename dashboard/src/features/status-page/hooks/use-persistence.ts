import { useState, useCallback } from 'react'
import type { ServiceSection } from '../services'

const ORDER_KEY = 'status-card-order'
const COLLAPSED_KEY = 'status-sections-collapsed'

function loadOrder(): Record<ServiceSection, string[]> {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (raw) return JSON.parse(raw) as Record<ServiceSection, string[]>
  } catch {
    // ignore
  }
  return { external: [], homelab: [] }
}

function saveOrder(order: Record<ServiceSection, string[]>) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order))
  } catch {
    // ignore
  }
}

function loadCollapsed(): Set<ServiceSection> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    if (raw) return new Set(JSON.parse(raw) as ServiceSection[])
  } catch {
    // ignore
  }
  return new Set()
}

function saveCollapsed(collapsed: Set<ServiceSection>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  } catch {
    // ignore
  }
}

export function usePersistence() {
  const [order, setOrderState] = useState<Record<ServiceSection, string[]>>(loadOrder)
  const [collapsed, setCollapsedState] = useState<Set<ServiceSection>>(loadCollapsed)

  const setOrder = useCallback((section: ServiceSection, newOrder: string[]) => {
    setOrderState(prev => {
      const next = { ...prev, [section]: newOrder }
      saveOrder(next)
      return next
    })
  }, [])

  const toggleCollapsed = useCallback((section: ServiceSection) => {
    setCollapsedState(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      saveCollapsed(next)
      return next
    })
  }, [])

  return { order, setOrder, collapsed, toggleCollapsed }
}

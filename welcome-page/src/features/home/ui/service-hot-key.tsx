import { useCallback } from 'react'
import { useHotkey } from '../../../app/hooks/use-hotkey.ts'
import { HomeService } from '../data/services.types.ts'

function openService(service: HomeService) {
  window.open(service.url, '_self', 'noopener,noreferrer')
}

interface ServiceHotkeyProps {
  service: HomeService
}

export function ServiceHotkey({ service }: ServiceHotkeyProps) {
  const handler = useCallback(() => openService(service), [service])
  useHotkey(service.shortcut!, handler)
  return null
}

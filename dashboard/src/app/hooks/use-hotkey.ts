import { useEffect } from 'react'
import { getHotkeyManager, type Hotkey } from '@tanstack/hotkeys'

/**
 * Register a single hotkey while the component is mounted.
 * Uses the TanStack HotkeyManager singleton under the hood.
 *
 * @param key - Hotkey string, e.g. 'g', 'Mod+S', 'Shift+?'
 * @param handler - Callback to invoke when the hotkey fires
 */
export function useHotkey(key: string, handler: () => void) {
  useEffect(() => {
    const manager = getHotkeyManager()
    const handle = manager.register(key as Hotkey, handler, { ignoreInputs: true })
    return () => handle.unregister()
  }, [key, handler])
}

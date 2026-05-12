import { describe, it, expect } from 'vitest'
import { HOME_CATEGORIES } from '../../src/features/home/data/services'

describe('home hotkeys', () => {
  it('hotkey have to be unique', async () => {
    const shortcuts = HOME_CATEGORIES.flatMap(i => i.services.map(s => s.shortcut)).filter(
      s => s !== undefined
    )
    expect(new Set(shortcuts).size).toBe(shortcuts.length)
  })
})

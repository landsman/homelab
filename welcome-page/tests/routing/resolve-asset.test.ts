import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `BASE_PATH` is captured once at module load, so each test sets up
// `window.__BASE_PATH__` and re-imports the module to get a fresh value.
async function loadWithBase(base: string | undefined) {
  vi.resetModules()
  if (base === undefined) {
    delete (globalThis as { window?: unknown }).window
  } else {
    ;(globalThis as { window?: { __BASE_PATH__?: string } }).window = {
      __BASE_PATH__: base,
    }
  }
  return await import('../../src/app/config/routing/base-path')
}

describe('resolveAsset', () => {
  const originalWindow = (globalThis as { window?: unknown }).window

  beforeEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window
    } else {
      ;(globalThis as { window?: unknown }).window = originalWindow
    }
  })

  describe('at root base path', () => {
    it('keeps a root-absolute path unchanged', async () => {
      const { resolveAsset } = await loadWithBase('/')
      expect(resolveAsset('/icons/ui/refresh.svg')).toBe('/icons/ui/refresh.svg')
    })

    it('prefixes a bare path with /', async () => {
      const { resolveAsset } = await loadWithBase('/')
      expect(resolveAsset('icons/ui/refresh.svg')).toBe('/icons/ui/refresh.svg')
    })
  })

  describe('at a subpath', () => {
    it('rewrites a root-absolute path under the subpath', async () => {
      const { resolveAsset } = await loadWithBase('/welcome-page/')
      expect(resolveAsset('/icons/ui/refresh.svg')).toBe('/welcome-page/icons/ui/refresh.svg')
    })

    it('rewrites a bare path under the subpath', async () => {
      const { resolveAsset } = await loadWithBase('/welcome-page/')
      expect(resolveAsset('icons/ui/refresh.svg')).toBe('/welcome-page/icons/ui/refresh.svg')
    })

    it('appends a missing trailing slash to the base', async () => {
      const { resolveAsset } = await loadWithBase('/welcome-page')
      expect(resolveAsset('/icons/x.svg')).toBe('/welcome-page/icons/x.svg')
    })
  })

  describe('absolute URLs pass through unchanged', () => {
    it.each([
      'https://example.com/a.svg',
      'http://example.com/a.svg',
      '//cdn.example.com/a.svg',
      'data:image/svg+xml,<svg/>',
      'blob:https://example.com/abc',
    ])('%s', async url => {
      const { resolveAsset } = await loadWithBase('/welcome-page/')
      expect(resolveAsset(url)).toBe(url)
    })
  })

  describe('fallbacks', () => {
    it('falls back to / when window is absent', async () => {
      const { resolveAsset, BASE_PATH, ROUTER_BASEPATH } = await loadWithBase(undefined)
      expect(BASE_PATH).toBe('/')
      expect(ROUTER_BASEPATH).toBe('')
      expect(resolveAsset('/icons/x.svg')).toBe('/icons/x.svg')
    })

    it('falls back to / when __BASE_PATH__ is an empty string', async () => {
      const { BASE_PATH, resolveAsset } = await loadWithBase('')
      expect(BASE_PATH).toBe('/')
      expect(resolveAsset('icons/x.svg')).toBe('/icons/x.svg')
    })
  })

  it('strips trailing slash for ROUTER_BASEPATH', async () => {
    const { ROUTER_BASEPATH } = await loadWithBase('/welcome-page/')
    expect(ROUTER_BASEPATH).toBe('/welcome-page')
  })
})

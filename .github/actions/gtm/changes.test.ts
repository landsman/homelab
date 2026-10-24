import { expect, test } from 'bun:test'
import { GtmChange, gtmChange } from './changes.ts'

// A change the gtm jobs miss leaves GTM behind the config without a word, so
// what counts as one is pinned here.

const paths = (...paths: string[]) => ({ kind: 'paths' as const, paths })

test('the config, its state and the gtm-code version count', () => {
  expect(gtmChange(paths('insuit/analytics.yaml'), 'insuit')).toBe(GtmChange.Config)
  expect(gtmChange(paths('insuit/.analytics/state.json'), 'insuit')).toBe(GtmChange.State)
  expect(gtmChange(paths('insuit/package.json'), 'insuit')).toBe(GtmChange.Toolchain)
})

test('the config wins over the rest of the same change', () => {
  expect(gtmChange(paths('insuit/package.json', 'insuit/analytics.yaml'), 'insuit')).toBe(GtmChange.Config)
})

test('a site at the root of its repo, or written with a slash', () => {
  expect(gtmChange(paths('analytics.yaml'), '.')).toBe(GtmChange.Config)
  expect(gtmChange(paths('insuit/analytics.yaml'), '.')).toBe(GtmChange.None)
  expect(gtmChange(paths('insuit/analytics.yaml'), 'insuit/')).toBe(GtmChange.Config)
})

test('a hand-started run always applies', () => {
  expect(gtmChange({ kind: 'all' }, 'insuit')).toBe(GtmChange.Manual)
})

test('anything else is none', () => {
  expect(gtmChange(paths(), 'insuit')).toBe(GtmChange.None)
  expect(gtmChange(paths('insuit/src/main.tsx', 'insuit/.env.analytics.example', 'other/analytics.yaml'), 'insuit')).toBe(
    GtmChange.None,
  )
  expect(gtmChange(paths('insuit/package.json.bak', '.github/actions/gtm/action.yml'), 'insuit')).toBe(GtmChange.None)
})

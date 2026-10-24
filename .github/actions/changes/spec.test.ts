import { expect, test } from 'bun:test'
import { detect, parseSpec } from './detect.ts'

// This repo's own spec, .github/changes.yml: a path it files under the wrong
// feature skips a preview or a GTM run without a word.

const spec = parseSpec(await Bun.file(new URL('../../changes.yml', import.meta.url)).text())
const value = (feature: string, ...paths: string[]) => detect(spec, { kind: 'paths', paths })[feature]

test("insuit's site: what it serves, not what is around it", () => {
  for (const path of [
    'insuit/content/cv/cv.md',
    'insuit/content/blog/hello.mdx',
    'insuit/messages/en.json',
    'insuit/package.json',
    'insuit/public/assets/cv/new.jpg',
  ])
    expect(value('insuit-site', path)).toBe('changed')
  for (const path of [
    'insuit/infra/main.tf',
    'insuit/Makefile',
    'insuit/README.md',
    'insuit/scripts/preview.ts',
    'insuit/tests/e2e/home.spec.ts',
    'insuit/analytics.yaml',
    'insuit/.analytics/state.json',
    '.github/workflows/insuit-ci.yml',
    'dashboard/src/main.tsx',
  ])
    expect(value('insuit-site', path)).toBe('none')
})

test("insuit's GTM: the config, its state, the gtm-code version", () => {
  expect(value('insuit-gtm', 'insuit/analytics.yaml', 'insuit/package.json')).toBe('config')
  expect(value('insuit-gtm', 'insuit/.analytics/state.json')).toBe('state')
  expect(value('insuit-gtm', 'insuit/package.json')).toBe('toolchain')
  expect(value('insuit-gtm', 'insuit/src/main.tsx', 'insuit/.env.analytics.example', '.github/actions/gtm/action.yml')).toBe('none')
})

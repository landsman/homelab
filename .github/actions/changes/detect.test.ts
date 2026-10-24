import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { changedPaths, detect, parseSpec, type Gh } from './detect.ts'

// Which files a run is asked about decides whether every feature's jobs run,
// so each event is pinned here, with gh answered by a fake.

const dir = mkdtempSync(join(tmpdir(), 'detect-'))
afterAll(() => rmSync(dir, { recursive: true }))

test('a pull request is asked for its own files', async () => {
  const { gh, calls } = fakeGh('insuit/analytics.yaml\ninsuit/src/main.tsx\n')
  const changed = await changedPaths(run('pull_request', { pull_request: { number: 500 } }), gh)
  expect(calls).toEqual([['pr', 'diff', '500', '--repo', 'landsman/homelab', '--name-only']])
  expect(changed).toEqual({ kind: 'paths', paths: ['insuit/analytics.yaml', 'insuit/src/main.tsx'] })
})

test('a push compares what it replaced with what it pushed', async () => {
  const { gh, calls } = fakeGh('insuit/package.json\n')
  const changed = await changedPaths(run('push', { before: 'aaa' }), gh)
  expect(calls).toEqual([['api', 'repos/landsman/homelab/compare/aaa...bbb', '--jq', '.files[].filename']])
  expect(changed).toEqual({ kind: 'paths', paths: ['insuit/package.json'] })
})

test('a push that opens a branch, and a hand-started run, apply everything without asking', async () => {
  const { gh, calls } = fakeGh('')
  expect(await changedPaths(run('push', { before: '0'.repeat(40) }), gh)).toEqual({ kind: 'all' })
  expect(await changedPaths(run('workflow_dispatch', {}), gh)).toEqual({ kind: 'all' })
  expect(calls).toEqual([])
})

const spec = parseSpec(`
site:
  - value: changed
    paths: ['site/**', '!site/*.md', '!site/tests/**']
gtm:
  - { value: config, paths: ['site/analytics.yaml'] }
  - { value: toolchain, paths: ['site/package.json'] }
`)

test('each feature takes the value of its first rule a path matches', () => {
  expect(detect(spec, { kind: 'paths', paths: ['site/package.json', 'site/analytics.yaml'] })).toEqual({
    site: 'changed',
    gtm: 'config',
  })
  expect(detect(spec, { kind: 'paths', paths: ['site/package.json'] })).toEqual({ site: 'changed', gtm: 'toolchain' })
})

test('a later ! takes a path back out, and only what it matches', () => {
  expect(detect(spec, { kind: 'paths', paths: ['site/README.md', 'site/tests/a.ts'] }).site).toBe('none')
  expect(detect(spec, { kind: 'paths', paths: ['site/README.md', 'site/content/cv.md'] }).site).toBe('changed')
})

test('nothing matched is none, a hand-started run is all', () => {
  expect(detect(spec, { kind: 'paths', paths: ['other/main.ts'] })).toEqual({ site: 'none', gtm: 'none' })
  expect(detect(spec, { kind: 'all' })).toEqual({ site: 'all', gtm: 'all' })
})

test('a spec that would be read wrongly is refused', () => {
  expect(() => parseSpec('- site')).toThrow('a map of features')
  expect(() => parseSpec('site: { value: x }')).toThrow('site needs a list')
  expect(() => parseSpec("site: [{ value: none, paths: ['a'] }]")).toThrow('none and all are taken')
  expect(() => parseSpec("site: [{ value: x, paths: 'a/**' }]")).toThrow('site needs a list')
})

/** The environment GitHub gives a run of this event. */
function run(event: string, payload: object): NodeJS.ProcessEnv {
  const path = join(dir, `${event}.json`)
  writeFileSync(path, JSON.stringify(payload))
  return { GITHUB_EVENT_NAME: event, GITHUB_EVENT_PATH: path, GITHUB_REPOSITORY: 'landsman/homelab', GITHUB_SHA: 'bbb' }
}

function fakeGh(answer: string): { gh: Gh; calls: string[][] } {
  const calls: string[][] = []
  return { gh: async args => (calls.push(args), answer), calls }
}

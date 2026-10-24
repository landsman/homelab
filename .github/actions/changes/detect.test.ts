import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { changedPaths, outputs, type Gh } from './detect.ts'

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

test('one output line per feature', () => {
  expect(outputs({ kind: 'paths', paths: ['insuit/analytics.yaml'] }, 'insuit')).toBe('gtm=config')
  expect(outputs({ kind: 'paths', paths: [] }, 'insuit')).toBe('gtm=none')
  expect(outputs({ kind: 'all' }, 'insuit')).toBe('gtm=manual')
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

// What migrate.ts would get wrong silently: a migration run twice, one recorded although it
// failed or did not take, the ones after a failure run anyway, a lock left behind that blocks
// every later run, a second run started while one holds the lock, another box's migration, and
// a run missing from the log.
//
// A copy of migrate.ts in a throwaway folder, as on a box, with real migrations in the folder above it. Each
// one's change is a file named after it, so `done` is "that file exists", and `up` also appends
// to `ran`, which the test reads.
import { beforeEach, expect, test } from 'bun:test'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dir = '' // where the migrations, .applied and the log live; the tool sits in dir/tool

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'migrate-'))
  mkdirSync(join(dir, 'tool'))
  copyFileSync(join(import.meta.dir, 'migrate.ts'), join(dir, 'tool', 'migrate.ts'))
})

function migration(name: string, { up = 'works', hosts = "'nas'" } = {}) {
  const body = {
    works: `fs.writeFileSync('${name}.done', '')`,
    throws: `throw new Error('boom')`,
    'does not take': '',
  }[up]
  writeFileSync(
    join(dir, name),
    `import fs from 'node:fs'
export default {
  description: 'makes ${name}.done',
  hosts: [${hosts}],
  done: () => fs.existsSync('${name}.done'),
  up: () => { fs.appendFileSync('ran', '${name}\\n'); ${body} },
}`
  )
}

function migrate(command = 'run') {
  return Bun.spawnSync(['bun', join(dir, 'tool', 'migrate.ts'), command], {
    cwd: dir, // where the test's migrations write, so their `done` and `ran` find it
    env: { ...process.env, MIGRATE_HOST: 'nas' },
  })
}

const ran = () => (existsSync(join(dir, 'ran')) ? readFileSync(join(dir, 'ran'), 'utf8') : '')
const recorded = () => readFileSync(join(dir, '.applied'), 'utf8')

test('runs each migration once, in name order', () => {
  migration('0002-b.ts')
  migration('0001-a.ts')
  writeFileSync(join(dir, 'README.md'), 'not a migration')
  expect(migrate().exitCode).toBe(0)
  expect(migrate().exitCode).toBe(0)
  expect(ran()).toBe('0001-a.ts\n0002-b.ts\n')
  expect(recorded()).toBe('0001-a.ts\n0002-b.ts\n')
})

test('a change already in place is recorded without running up', () => {
  migration('0001-a.ts')
  writeFileSync(join(dir, '0001-a.ts.done'), '')
  expect(migrate().exitCode).toBe(0)
  expect(ran()).toBe('')
  expect(recorded()).toBe('0001-a.ts\n')
})

test('a failed migration is not recorded, nothing after it runs, and the lock is gone', () => {
  migration('0001-ok.ts')
  migration('0002-broken.ts', { up: 'throws' })
  migration('0003-later.ts')
  const result = migrate()
  expect(result.exitCode).toBe(1)
  expect(result.stderr.toString()).toContain('boom')
  expect(recorded()).toBe('0001-ok.ts\n')
  expect(ran()).toBe('0001-ok.ts\n0002-broken.ts\n')
  expect(existsSync(join(dir, '.lock'))).toBe(false)
})

test('an up that does not make done true fails, unrecorded', () => {
  migration('0001-noop.ts', { up: 'does not take' })
  const result = migrate()
  expect(result.exitCode).toBe(1)
  expect(result.stderr.toString()).toContain('0001-noop.ts failed: up ran, but done is still false')
  expect(existsSync(join(dir, '.applied'))).toBe(false)
})

test('the next run picks up at the migration that failed', () => {
  migration('0001-ok.ts')
  migration('0002-broken.ts', { up: 'throws' })
  migrate()
  migration('0002-broken.ts')
  expect(migrate().exitCode).toBe(0)
  expect(recorded()).toBe('0001-ok.ts\n0002-broken.ts\n')
})

test('refuses to run while another run holds the lock', () => {
  migration('0001-a.ts')
  writeFileSync(join(dir, '.lock'), '')
  expect(migrate().exitCode).toBe(1)
  expect(ran()).toBe('')
  expect(existsSync(join(dir, '.lock'))).toBe(true)
})

test("runs only the migrations for this box, and leaves another box's unrecorded", () => {
  migration('0001-nas.ts')
  migration('0002-other.ts', { hosts: "'other'" })
  migration('0003-both.ts', { hosts: "'other', 'nas'" })
  expect(migrate().exitCode).toBe(0)
  expect(ran()).toBe('0001-nas.ts\n0003-both.ts\n')
  expect(recorded()).toBe('0001-nas.ts\n0003-both.ts\n')
})

test('pending lists what this box has not run, and runs nothing', () => {
  migration('0001-a.ts')
  migration('0002-b.ts')
  migration('0003-other.ts', { hosts: "'other'" })
  writeFileSync(join(dir, '.applied'), '0001-a.ts\n')
  expect(migrate('pending').stdout.toString()).toBe('0002-b.ts\n')
  expect(ran()).toBe('')
})

test('logs each migration starting with its description, and how it ended', () => {
  migration('0001-ok.ts')
  migration('0002-in-place.ts')
  writeFileSync(join(dir, '0002-in-place.ts.done'), '')
  migration('0003-broken.ts', { up: 'throws' })
  migrate()
  const events = readFileSync(join(dir, 'migrations.log'), 'utf8')
    .trimEnd()
    .split('\n')
    .map(line => line.split('\t').slice(1).join(' | '))
  expect(events).toEqual([
    'nas | 0001-ok.ts | started | makes 0001-ok.ts.done',
    'nas | 0001-ok.ts | done',
    'nas | 0002-in-place.ts | started | makes 0002-in-place.ts.done',
    'nas | 0002-in-place.ts | already in place',
    'nas | 0003-broken.ts | started | makes 0003-broken.ts.done',
    'nas | 0003-broken.ts | failed | boom',
  ])
})

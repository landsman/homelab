#!/usr/bin/env bun
// One-off changes to the boxes, the files in the folder above this one, each run once per box.
// `make migrate BOX=<ssh host>` at the root sends that folder to the box and runs this there; every box gets every migration, and each names the boxes it is for.
//
// usage:
//   bun migrate.ts pending   list the migrations this box has not run yet
//   bun migrate.ts run       run them in name order, stopping at the first that fails
//
// On the box, ../migrations.txt lists which ran, one name per line, so `cat` shows it and
// deleting a line runs that one again; ../migrations.log is the history of every run.
// rsync sends tracked files only, so it never overwrites either. ../.lock keeps two
// runs apart; a run killed hard leaves it, to delete by hand.
import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'

// What a migration file exports, as `export default { … } satisfies Migration`, in a file named
// ../NNNN-what-it-does.ts. A run can die half way, so a migration says whether its change is
// already in place: `done` is asked before `up`, which is skipped when the change is there,
// and again after, and a migration whose `up` did not make `done` true fails, unrecorded.
export interface Migration {
  // What it changes and why, one sentence: the log keeps it beside each run.
  description: string
  // The boxes it runs on, by `hostname` (nas for the Pi). Required: every box gets every file,
  // so a migration that forgot to say would run everywhere.
  hosts: [string, ...string[]]
  done(): boolean | Promise<boolean>
  up(): void | Promise<void>
}

const dir = join(import.meta.dir, '..')
const applied = join(dir, 'migrations.txt')
const lock = join(dir, '.lock')
const history = join(dir, 'migrations.log')
const host = process.env.MIGRATE_HOST ?? hostname()

const commands: Record<string, () => Promise<void>> = {
  pending: async () => (await pending()).forEach(({ name }) => console.log(name)),
  run,
}
const command = commands[process.argv[2] ?? '']
if (!command) {
  const usage =
    readFileSync(import.meta.path, 'utf8').match(/^\/\/ usage:[\s\S]*?(?=^\/\/\n)/m)?.[0] ?? ''
  process.stderr.write(usage.replace(/^\/\/ ?/gm, ''))
  process.exit(2)
}
try {
  await command()
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}

async function run() {
  try {
    closeSync(openSync(lock, 'wx'))
  } catch {
    throw new Error(
      `${lock} exists: another run holds it, or one was killed; delete it if none runs`
    )
  }
  try {
    for (const { name, migration } of await pending()) {
      log(name, 'started', migration.description)
      try {
        if (await migration.done()) {
          log(name, 'already in place')
        } else {
          await migration.up()
          if (!(await migration.done())) throw new Error('up ran, but done is still false')
          log(name, 'done')
        }
      } catch (e) {
        log(name, 'failed', (e as Error).message)
        throw new Error(`${name} failed: ${(e as Error).message}\nnothing after it ran`)
      }
      appendFileSync(applied, `${name}\n`)
    }
  } finally {
    rmSync(lock)
  }
}

// One line per event, tab-separated, appended to migrations.log and printed:
// <time UTC> <box> <migration> <started | already in place | done | failed> [description | error]
function log(name: string, event: string, detail = '') {
  const line = [new Date().toISOString(), host, name, event, detail.replace(/\s+/g, ' ')]
    .join('\t')
    .trimEnd()
  appendFileSync(history, `${line}\n`)
  console.log(line)
}

async function pending(): Promise<{ name: string; migration: Migration }[]> {
  const done = new Set(existsSync(applied) ? readFileSync(applied, 'utf8').split('\n') : [])
  const names = readdirSync(dir)
    .filter(name => /^\d{4}-.+\.ts$/.test(name) && !done.has(name))
    .sort()
  const loaded = await Promise.all(
    names.map(async name => ({
      name,
      migration: (await import(join(dir, name))).default as Migration,
    }))
  )
  return loaded.filter(({ migration }) => migration.hosts.includes(host))
}

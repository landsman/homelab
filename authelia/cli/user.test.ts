// What user.ts would get wrong silently: a refused integration or a reworded answer leaving
// an empty forgejo_aud behind, the audience written under the wrong user, a second subject
// pinned for a user who has one (their integration rule then names a subject their tokens
// never carry), and a user added twice.
//
// No Authelia, Forgejo or docker: `docker` is a stub on PATH that records its calls and
// answers with what the real containers print.
import { afterAll, beforeEach, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = join(import.meta.dir, 'user.ts')
const dir = mkdtempSync(join(tmpdir(), 'authelia-user-'))
afterAll(() => rmSync(dir, { recursive: true }))
const users = join(dir, 'users', 'users.yml') // its folder made by the first login
const calls = join(dir, 'calls')

mkdirSync(join(dir, 'bin'))
writeFileSync(
  join(dir, 'bin', 'docker'),
  `#!/bin/sh
echo "docker $*" >>"$CALLS"
case "$*" in
*"identifiers add"*) touch "$CALLS.added" ;;
*"identifiers export"*)
  # Authelia's answer for an empty table, until a subject is added.
  if [ -n "$IDS" ]; then printf '%s\\n' "$IDS"
  elif [ -e "$CALLS.added" ]; then printf '%s\\n' "$IDS_ADDED"
  else echo 'Error: no data to export' >&2; exit 1; fi ;;
*create-authorized-integration*) printf '%s\\n' "$FJ_OUT"; exit "\${FJ_RC:-0}" ;;
esac
`
)
chmodSync(join(dir, 'bin', 'docker'), 0o755)

beforeEach(() => {
  writeFileSync(calls, '')
  rmSync(`${calls}.added`, { force: true })
})

/** Runs user.ts; ids and fj set what Authelia's identifiers and Forgejo's CLI answer. */
async function user(
  args: string[],
  { stdin = '', ids = '', idsAdded = '', fj = '', fjExit = 0 } = {}
) {
  const proc = Bun.spawn(['bun', script, ...args], {
    stdin: new Response(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      CALLS: calls,
      USERS_FILE: users,
      FORGEJO_MCP_HOST: 'mcp.example',
      IDS: ids,
      IDS_ADDED: idsAdded,
      FJ_OUT: fj,
      FJ_RC: String(fjExit),
    },
  })
  const code = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  return { code, out: stdout + stderr }
}

type Users = Record<string, { password: string; extra: { forgejo_aud: string } }>
const parsed = () => (Bun.YAML.parse(readFileSync(users, 'utf8')) as { users: Users }).users

/** What `authelia storage user identifiers export` writes for one user. */
const idsFor = (name: string, id: string) =>
  [
    'identifiers:',
    '    - service: openid',
    '      sector_id: ""',
    `      username: ${name}`,
    `      identifier: ${id}`,
  ].join('\n')

/** What `forgejo admin user create-authorized-integration` prints. */
const created = JSON.stringify(
  {
    message: 'Authorized integration was successfully created.',
    name: 'forgejo-mcp',
    audience: 'u:7:1111',
    claim_rules: [],
  },
  null,
  2
)

test('login adds a user with a hash and an empty forgejo_aud', async () => {
  expect((await user(['login', 'alice', 'a@example.org'], { stdin: 'pw\n' })).code).toBe(0)
  await user(['login', 'bob', 'b@example.org'], { stdin: 'pw\n' })
  expect(await Bun.password.verify('pw', parsed().alice.password)).toBe(true)
  expect(parsed().alice.extra.forgejo_aud).toBe('')
})

test('login leaves a user who is already there alone', async () => {
  const before = readFileSync(users, 'utf8')
  expect((await user(['login', 'alice', 'a@example.org'], { stdin: 'other\n' })).out).toContain(
    'alice is in'
  )
  expect(readFileSync(users, 'utf8')).toBe(before)
})

test('login refuses an empty password', async () =>
  expect((await user(['login', 'carol', 'c@example.org'], { stdin: '\n' })).code).not.toBe(0))

test('integration writes the audience under that user only', async () => {
  const r = await user(['integration', 'bob'], { ids: idsFor('bob', '2222'), fj: created })
  expect(r.code).toBe(0)
  expect(parsed().bob.extra.forgejo_aud).toBe('u:7:1111')
  expect(parsed().alice.extra.forgejo_aud).toBe('')
})

test('integration ties the rule to the subject already pinned, and pins no second one', async () => {
  await user(['integration', 'alice'], { ids: idsFor('alice', '3333'), fj: created })
  const log = readFileSync(calls, 'utf8')
  expect(log).toContain('--claim-eq sub=3333')
  expect(log).not.toContain('identifiers add')
})

test('integration pins a subject for the first user, when Authelia has none to export', async () => {
  await user(['login', 'erin', 'e@example.org'], { stdin: 'pw\n' })
  const r = await user(['integration', 'erin'], { idsAdded: idsFor('erin', '5555'), fj: created })
  expect(r.code).toBe(0)
  expect(readFileSync(calls, 'utf8')).toContain('--claim-eq sub=5555')
  expect(parsed().erin.extra.forgejo_aud).toBe('u:7:1111')
})

test('integration fails when Forgejo refuses it, and writes nothing', async () => {
  await user(['login', 'dave', 'd@example.org'], { stdin: 'pw\n' })
  const r = await user(['integration', 'dave'], {
    ids: idsFor('dave', '4444'),
    fj: 'Command error: invalid issuer',
    fjExit: 1,
  })
  expect(r.code).not.toBe(0)
  expect(parsed().dave.extra.forgejo_aud).toBe('')
})

test('integration fails when the answer has no audience', async () => {
  const r = await user(['integration', 'dave'], {
    ids: idsFor('dave', '4444'),
    fj: '{ "audience_v2": "x" }',
  })
  expect(r.code).not.toBe(0)
})

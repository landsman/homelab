#!/usr/bin/env bun
// A person who may use forgejo-mcp: their Authelia login, and the Forgejo Authorized
// Integration that lets forgejo-mcp act as them. Run on the Pi, in the authelia folder, once per
// person: `make user`, then `make integration` once forgejo-mcp is up.
//
// usage:
//   op read op://<vault>/<item>/password | bun cli/user.ts login <username> <email>
//       add the user to users.yml, the password from stdin
//   bun cli/user.ts integration <username>
//       create their integration in Forgejo, write its audience into users.yml as forgejo_aud
//
// Two steps because of the order things start in: Authelia needs the user to exist,
// forgejo-mcp needs Authelia to answer, and Forgejo refuses an integration whose issuer
// (forgejo-mcp) does not answer yet.
//
// The integration's rule `sub = <the user's Authelia subject>` ties the two: without it,
// anyone whose token carried this audience would act as this user. The subject is pinned
// in Authelia's database before the first login, so the rule can name it.
//
// Both steps are idempotent: a user already in users.yml, or one with a forgejo_aud, is
// left alone.
import { $ } from 'bun'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const usersFile = process.env.USERS_FILE ?? 'users.yml'
const composeFile = process.env.COMPOSE_FILE ?? 'compose.yml'
const scopes = (process.env.SCOPES ?? 'read:user,write:repository,write:issue').split(',')

const commands: Record<string, (args: string[]) => Promise<void>> = {
  login,
  integration,
}
const [command = '', ...args] = process.argv.slice(2)
const run = commands[command]
if (!run) {
  const usage =
    readFileSync(import.meta.path, 'utf8').match(/^\/\/ usage:[\s\S]*?(?=^(?!\/\/))/m)?.[0] ?? ''
  process.stderr.write(usage.replace(/^\/\/ ?/gm, ''))
  process.exit(2)
}
try {
  await run(args)
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}

async function login([user, email]: string[]) {
  if (!user || !email) {
    throw new Error('usage: cli/user.ts login <username> <email>')
  }
  const users = readUsers()
  if (users[user]) {
    return console.log(`${user} is in ${usersFile}`)
  }

  // As `$(cat)` would: a password piped from `op read` ends in a newline that is not its.
  const password = (await Bun.stdin.text()).replace(/\n+$/, '')
  if (!password) {
    throw new Error('no password on stdin')
  }
  users[user] = {
    displayname: user,
    email,
    password: await hash(password),
    extra: { forgejo_aud: '' },
  }
  writeUsers(users)
  console.log(`added ${user}`)
}

type User = {
  displayname: string
  email: string
  password: string
  extra?: { forgejo_aud?: string }
}

/** An argon2 digest from a throwaway container of the image compose.yml runs: Authelia
 *  itself will not start before users.yml exists. The password goes in on stdin. */
async function hash(password: string) {
  type Compose = { services: { authelia: { image: string } } }
  const compose = Bun.YAML.parse(readFileSync(composeFile, 'utf8')) as Compose
  const image = compose.services.authelia.image
  const generate = 'authelia crypto hash generate argon2 --password "$(cat)"'
  const out =
    await $`docker run --rm -i ${image} sh -c ${generate} < ${new Response(password)}`.text()

  const digest = out.match(/^Digest: (\S+)$/m)?.[1]
  if (!digest) {
    throw new Error(`no digest from authelia crypto hash:\n${out}`)
  }
  return digest
}

async function integration([user]: string[]) {
  if (!user) {
    throw new Error('usage: cli/user.ts integration <username>')
  }
  const host = process.env.FORGEJO_MCP_HOST
  if (!host) {
    throw new Error('set FORGEJO_MCP_HOST, see .env.example')
  }
  const users = readUsers()
  const entry = users[user]
  if (!entry) {
    throw new Error(`${user} is not in ${usersFile} — run login first`)
  }
  if (entry.extra?.forgejo_aud) {
    return console.log(`${user} has a forgejo_aud`)
  }

  const sub = await subject(user)
  const flags = [
    ['--username', user],
    ['--name', 'forgejo-mcp'],
    ['--issuer', `https://${host}/issuer`],
    ['--claim-eq', `sub=${sub}`],
    ...scopes.map(scope => ['--scope', scope]),
  ].flat()
  const result =
    await $`docker exec -u git forgejo forgejo admin user create-authorized-integration ${flags}`
      .nothrow()
      .quiet()
  const out = `${result.stdout}${result.stderr}`
  if (result.exitCode !== 0) {
    throw new Error(out)
  }

  const audience = audienceIn(result.stdout.toString())
  if (!audience) {
    throw new Error(`no audience in Forgejo's answer — did its output change?\n${out}`)
  }
  entry.extra = {
    ...entry.extra,
    forgejo_aud: audience,
  }
  writeUsers(users)
  console.log(`${user}: integration created, forgejo_aud written (sub ${sub})`)
}

/** The user's opaque subject, the `sub` of their tokens. Pinned now if they have none yet,
 *  so it is known before the first login. */
async function subject(user: string) {
  const pinned = await subjectOf(user)
  if (pinned) {
    return pinned
  }
  await $`docker exec authelia authelia storage user identifiers add ${user}`.quiet()

  const added = await subjectOf(user)
  if (!added) {
    throw new Error(`no openid subject for ${user} in Authelia's database`)
  }
  return added
}

async function subjectOf(user: string) {
  const exportIds = [
    'authelia storage user identifiers export --file /tmp/ids.yml >/dev/null',
    'cat /tmp/ids.yml',
    'rm /tmp/ids.yml',
  ].join(' && ')
  const out = await $`docker exec authelia sh -c ${exportIds}`.text()

  type Identifier = { username: string; service: string; identifier: string }
  const parsed = Bun.YAML.parse(out) as { identifiers?: Identifier[] } | null
  const ids = parsed?.identifiers ?? []
  return ids.find(id => id.username === user && id.service === 'openid')?.identifier
}

/** forgejo admin user create-authorized-integration prints indented JSON. */
function audienceIn(out: string): string | undefined {
  try {
    const answer = JSON.parse(out) as { audience?: string }
    return answer.audience || undefined
  } catch {
    return undefined
  }
}

function readUsers(): Record<string, User> {
  if (!existsSync(usersFile)) {
    return {}
  }
  const parsed = Bun.YAML.parse(readFileSync(usersFile, 'utf8')) as {
    users?: Record<string, User>
  } | null
  return parsed?.users ?? {}
}

/** Truncated and rewritten, never replaced: the container mounts this one file, and a
 *  mount of a file keeps the inode it started with, so a rename would never reach
 *  Authelia. 0600 when created: it holds password hashes. */
function writeUsers(users: Record<string, User>) {
  writeFileSync(usersFile, Bun.YAML.stringify({ users }, null, 2), { mode: 0o600 })
}

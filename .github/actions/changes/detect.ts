// What a CI run changed, per feature, as one `changes=<json>` line for
// $GITHUB_OUTPUT: {"insuit-site":"changed","insuit-gtm":"none"}. The features
// and their rules are the repo's own spec (.github/changes.yml by default);
// how they match is in parseSpec below. Reads the run from GitHub's own
// environment:
//
//   pull_request   the PR's files               gh pr diff
//   push           its before...after commits   the compare API
//   anything else  all: a hand-started run applies everything
//
//   SPEC=.github/changes.yml bun detect.ts      needs GH_TOKEN

import { $ } from 'bun'
import { match } from 'ts-pattern'

if (import.meta.main) {
  const spec = parseSpec(await Bun.file(process.env.SPEC ?? '.github/changes.yml').text())
  console.log(`changes=${JSON.stringify(detect(spec, await changedPaths(process.env)))}`)
}

/** Each feature's value: its first rule a changed path matches, else `none`. */
export function detect(spec: Spec, changed: Changed): Record<string, string> {
  return Object.fromEntries(
    Object.entries(spec).map(([feature, rules]) => [
      feature,
      match(changed)
        .with({ kind: 'all' }, () => 'all')
        .with({ kind: 'paths' }, ({ paths }) => rules.find(rule => paths.some(path => matches(rule.paths, path)))?.value ?? 'none')
        .exhaustive(),
    ]),
  )
}

/** A workflow's `paths:` filter: the last pattern that matches decides, a `!` one against. */
function matches(patterns: string[], path: string): boolean {
  let included = false
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!')
    if (new Bun.Glob(negated ? pattern.slice(1) : pattern).match(path)) included = !negated
  }
  return included
}

export type Spec = Record<string, Rule[]>
type Rule = { value: string; paths: string[] }

/** The YAML spec: `<feature>: [{ value, paths: [glob, '!glob', …] }, …]`. */
export function parseSpec(text: string): Spec {
  const spec = Bun.YAML.parse(text)
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) throw new Error('changes spec: a map of features')
  for (const [feature, rules] of Object.entries(spec)) {
    const valid =
      Array.isArray(rules) &&
      rules.every(
        rule =>
          typeof rule?.value === 'string' &&
          !['none', 'all'].includes(rule.value) &&
          Array.isArray(rule.paths) &&
          rule.paths.every((path: unknown) => typeof path === 'string'),
      )
    if (!valid) throw new Error(`changes spec: ${feature} needs a list of { value, paths }, and none and all are taken`)
  }
  return spec as Spec
}

export type Changed = { kind: 'all' } | { kind: 'paths'; paths: string[] }

/** Runs gh with these arguments and returns what it printed. */
export type Gh = (args: string[]) => Promise<string>

export async function changedPaths(env: NodeJS.ProcessEnv, gh: Gh = runGh): Promise<Changed> {
  const event = await Bun.file(env.GITHUB_EVENT_PATH ?? '').json()
  const repo = env.GITHUB_REPOSITORY
  return match(env.GITHUB_EVENT_NAME)
    .with('pull_request', async (): Promise<Changed> =>
      paths(await gh(['pr', 'diff', String(event.pull_request.number), '--repo', String(repo), '--name-only'])),
    )
    // A push that opens a branch has no before: nothing to compare against.
    .with('push', async (): Promise<Changed> =>
      /^0+$/.test(event.before)
        ? { kind: 'all' }
        : paths(await gh(['api', `repos/${repo}/compare/${event.before}...${env.GITHUB_SHA}`, '--jq', '.files[].filename'])),
    )
    .otherwise(async (): Promise<Changed> => ({ kind: 'all' }))
}

function paths(text: string): Changed {
  return { kind: 'paths', paths: text.split('\n').filter(Boolean) }
}

async function runGh(args: string[]): Promise<string> {
  return $`gh ${args}`.text()
}

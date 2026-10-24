// What a CI run changed, one `<feature>=<value>` line per feature for
// $GITHUB_OUTPUT. Each feature keeps its own rules beside its own action;
// `none` lets its jobs skip. Reads the run from GitHub's own environment:
//
//   pull_request   the PR's files               gh pr diff
//   push           its before...after commits   the compare API
//   anything else  all: a hand-started run applies everything
//
//   SITE=insuit bun detect.ts      needs GH_TOKEN; SITE defaults to the root

import { $ } from 'bun'
import { match } from 'ts-pattern'
import { gtmChange } from '#gtm/changes.ts'

if (import.meta.main) console.log(outputs(await changedPaths(process.env), process.env.SITE ?? '.'))

export function outputs(changed: Changed, site: string): string {
  return `gtm=${gtmChange(changed, site)}`
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

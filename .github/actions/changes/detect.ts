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

if (import.meta.main) {
  const changed = await changedPaths(process.env)
  const site = process.env.SITE ?? '.'
  console.log(`gtm=${gtmChange(changed, site)}`)
}

export type Changed = { kind: 'all' } | { kind: 'paths'; paths: string[] }

async function changedPaths(env: NodeJS.ProcessEnv): Promise<Changed> {
  const event = await Bun.file(env.GITHUB_EVENT_PATH ?? '').json()
  const repo = env.GITHUB_REPOSITORY
  return match(env.GITHUB_EVENT_NAME)
    .with('pull_request', async (): Promise<Changed> =>
      paths(await $`gh pr diff ${event.pull_request.number} --repo ${repo} --name-only`.text()),
    )
    // A push that opens a branch has no before: nothing to compare against.
    .with('push', async (): Promise<Changed> =>
      /^0+$/.test(event.before)
        ? { kind: 'all' }
        : paths(await $`gh api repos/${repo}/compare/${event.before}...${env.GITHUB_SHA} --jq .files[].filename`.text()),
    )
    .otherwise(async (): Promise<Changed> => ({ kind: 'all' }))
}

function paths(text: string): Changed {
  return { kind: 'paths', paths: text.split('\n').filter(Boolean) }
}

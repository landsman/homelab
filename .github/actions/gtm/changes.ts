// Which changes a site's GTM jobs act on, for the general detector
// (#changes/detect.ts). `none` lets them skip.

import { match } from 'ts-pattern'
import type { Changed } from '#changes/detect.ts'

export enum GtmChange {
  None = 'none',
  Config = 'config',
  State = 'state',
  Toolchain = 'toolchain',
  Action = 'action',
  Manual = 'manual',
}

export function gtmChange(changed: Changed, site: string): GtmChange {
  return match(changed)
    .with({ kind: 'all' }, () => GtmChange.Manual)
    .with({ kind: 'paths' }, ({ paths }) => classify(paths, site))
    .exhaustive()
}

/** The first rule a changed path falls under, in this order. */
function classify(paths: string[], site: string): GtmChange {
  const dir = site === '.' ? '' : `${site.replace(/\/+$/, '')}/`
  const rules: [(path: string) => boolean, GtmChange][] = [
    [path => path === `${dir}analytics.yaml`, GtmChange.Config],
    [path => path.startsWith(`${dir}.analytics/`), GtmChange.State],
    // The gtm-code version.
    [path => path === `${dir}package.json`, GtmChange.Toolchain],
    [path => path.startsWith('.github/actions/gtm/'), GtmChange.Action],
  ]
  return rules.find(([applies]) => paths.some(applies))?.[1] ?? GtmChange.None
}

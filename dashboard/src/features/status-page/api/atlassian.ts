import type { StatusPageData, StatusComponent } from './types'

export async function fetchAtlassian(baseUrl: string): Promise<StatusPageData> {
  const res = await fetch(`${baseUrl}/api/v2/summary.json`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as StatusPageData

  // Filter components:
  // 1. If we have top-level non-group components (like GitHub), show only those
  // 2. If all components are nested within groups (like Toggl), show the groups themselves as top-level indicators
  const nonGroups = data.components.filter(c => !c.group)
  const topLevelNonGroups = nonGroups.filter(c => !c.group_id)

  let componentsToDisplay: StatusComponent[]
  if (topLevelNonGroups.length > 0) {
    componentsToDisplay = topLevelNonGroups
  } else {
    // Fallback: show only components with no group_id (which are the groups themselves)
    // We explicitly set group to false so they are shown in StatusCard
    componentsToDisplay = data.components
      .filter(c => !c.group_id)
      .map(c => ({ ...c, group: false }))
  }

  const description = data.status.indicator === 'none' ? 'ok' : data.status.description
  return {
    ...data,
    status: { ...data.status, description },
    components: componentsToDisplay,
  }
}

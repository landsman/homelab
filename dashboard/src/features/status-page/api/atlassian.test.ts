import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAtlassian } from './atlassian.ts'

vi.stubGlobal('fetch', vi.fn())

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

describe('fetchAtlassian', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return top-level non-group components for flat structures (like GitHub)', async () => {
    const mockData = {
      status: { indicator: 'none', description: 'All Systems Operational' },
      components: [
        { id: '1', name: 'API', status: 'operational', group: false, group_id: null },
        { id: '2', name: 'Web', status: 'operational', group: false, group_id: null },
        { id: '3', name: 'Database', status: 'operational', group: false, group_id: '100' }, // Child of something
      ],
      incidents: [],
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)

    const result = await fetchAtlassian('https://status.github.com')

    expect(result.components).toHaveLength(2)
    expect(result.components.map(c => c.name)).toContain('API')
    expect(result.components.map(c => c.name)).toContain('Web')
    expect(result.status.description).toBe('ok')
  })

  it('should fallback to top-level groups when no top-level non-groups exist (like Toggl)', async () => {
    const mockData = {
      status: { indicator: 'none', description: 'All Systems Operational' },
      components: [
        { id: 'g1', name: 'Track', status: 'operational', group: true, group_id: null },
        { id: 'g2', name: 'Work', status: 'operational', group: true, group_id: null },
        { id: 'c1', name: 'Webapp', status: 'operational', group: false, group_id: 'g1' },
        { id: 'c2', name: 'API', status: 'operational', group: false, group_id: 'g1' },
      ],
      incidents: [],
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)

    const result = await fetchAtlassian('https://status.toggl.com')

    // It should return 'Track' and 'Work' as they have no group_id
    expect(result.components).toHaveLength(2)
    expect(result.components.map(c => c.name)).toContain('Track')
    expect(result.components.map(c => c.name)).toContain('Work')

    // Crucially, group should be false for these to be shown in StatusCard
    expect(result.components.every(c => !c.group)).toBe(true)
  })

  it('should show actual description when status is not none', async () => {
    const mockData = {
      status: { indicator: 'minor', description: 'Partial System Outage' },
      components: [],
      incidents: [],
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)

    const result = await fetchAtlassian('https://status.github.com')
    expect(result.status.description).toBe('Partial System Outage')
  })
})

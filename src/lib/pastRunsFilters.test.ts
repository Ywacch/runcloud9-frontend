import { describe, expect, it } from 'vitest'
import {
  dateRangeStart,
  filterPastRuns,
  mergeActiveAndHistory,
  type PastRunListItem,
} from './pastRunsFilters'

const base: PastRunListItem = {
  id: '1',
  namespace: 'ns-1',
  template: 'url-shortener',
  archetype: 'standard',
  status: 'terminated',
  createdAt: '2026-08-01T10:00:00.000Z',
  durationSeconds: 240,
  peakRps: 67,
  peakP99Ms: 2144,
}

describe('mergeActiveAndHistory', () => {
  const historyRow = {
    id: '1',
    namespace: 'ns-1',
    template: 'url-shortener',
    archetype: 'standard',
    status: 'terminated' as const,
    createdAt: '2026-08-01T10:00:00.000Z',
    durationSeconds: 240,
    peakRps: 67,
    peakP99Ms: 2144,
  }

  it('marks active as running and sorts newest first', () => {
    const merged = mergeActiveAndHistory({
      active: [
        {
          id: 'a1',
          namespace: 'ns-live',
          template: 'ecommerce',
          status: 'running',
          createdAt: '2026-08-03T12:00:00.000Z',
        },
      ],
      history: [historyRow],
    })
    expect(merged[0].status).toBe('running')
    expect(merged[0].template).toBe('ecommerce')
    expect(merged[1].id).toBe('1')
  })

  it('dedupes active namespace already in history', () => {
    const merged = mergeActiveAndHistory({
      active: [
        {
          id: 'a1',
          namespace: 'ns-1',
          template: 'url-shortener',
          status: 'running',
          createdAt: '2026-08-03T12:00:00.000Z',
        },
      ],
      history: [historyRow],
    })
    expect(merged).toHaveLength(1)
    expect(merged[0].status).toBe('terminated')
  })
})

describe('filterPastRuns', () => {
  const items: PastRunListItem[] = [
    base,
    {
      ...base,
      id: '2',
      namespace: 'ns-2',
      template: 'ecommerce',
      status: 'failed',
      createdAt: '2026-08-03T08:00:00.000Z',
    },
    {
      ...base,
      id: '3',
      namespace: 'ns-3',
      template: 'url-shortener',
      status: 'running',
      createdAt: '2026-08-03T15:00:00.000Z',
    },
  ]

  it('ANDs search + status', () => {
    const out = filterPastRuns(items, {
      search: 'url',
      status: 'running',
      dateRange: 'all',
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('3')
  })

  it('filters by today', () => {
    const now = new Date('2026-08-03T18:00:00')
    const out = filterPastRuns(items, {
      search: '',
      status: 'all',
      dateRange: 'today',
      now,
    })
    expect(out.map((i) => i.id).sort()).toEqual(['2', '3'])
  })

  it('dateRangeStart for last_7_days includes 7 local days', () => {
    const now = new Date(2026, 7, 3, 18, 0, 0) // Aug 3 local
    const start = dateRangeStart('last_7_days', now)
    expect(start?.getDate()).toBe(28) // Jul 28
    expect(start?.getMonth()).toBe(6)
  })
})

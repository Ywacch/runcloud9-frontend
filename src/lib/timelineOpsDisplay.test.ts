import { describe, expect, it } from 'vitest'
import { buildTimelineOpsViewModel, parseTimelineOps } from './timelineOpsDisplay'

describe('parseTimelineOps', () => {
  it('parses engine and optional rates', () => {
    expect(parseTimelineOps(null)).toBeNull()
    expect(
      parseTimelineOps({
        engine: 'redis',
        appendRate: 1.5,
        appendP99Ms: 12,
      }),
    ).toEqual({
      engine: 'redis',
      appendRate: 1.5,
      appendP99Ms: 12,
      rangeP99Ms: undefined,
      errorRate: undefined,
    })
  })
})

describe('buildTimelineOpsViewModel', () => {
  it('builds redis cost labels from cache stats', () => {
    const vm = buildTimelineOpsViewModel(
      { engine: 'redis', appendRate: 2, appendP99Ms: 40, rangeP99Ms: 8, errorRate: 0.01 },
      { engine: 'redis', timelineKeyCount: 120, evictionsLive: 0.5 },
      'live',
    )
    expect(vm?.costPrimaryLabel).toBe('timelines')
    expect(vm?.costPrimaryValue).toBe('120')
    expect(vm?.appendP99Ms).toBe('40 ms')
  })

  it('builds postgres cost from db table stats', () => {
    const vm = buildTimelineOpsViewModel(
      { engine: 'postgresql', appendRate: 1 },
      { engine: 'postgresql', relationBytes: 8192, deadTuples: 3 },
      'live',
    )
    expect(vm?.costPrimaryLabel).toBe('table size')
    expect(vm?.costSecondaryLabel).toBe('dead tuples')
    expect(vm?.costSecondaryValue).toBe('3')
  })
})

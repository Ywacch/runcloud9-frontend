import { describe, expect, it } from 'vitest'
import type { PhenomenonEntry } from './types'
import { buildReplyBeforeParentCard } from './replyBeforeParentCard'

const observerEntry: PhenomenonEntry = {
  phenomenon: 'reply_before_parent',
  fidelity: 'simulated',
  cost: { readsAffected: 37 },
  baseRate: {
    perThousand: 212,
    denominator: 'observer thread reads in window',
    reads: 175,
  },
  expected: { minPerThousand: 150, maxPerThousand: 400 },
  cause: { replicaApplyDelayMs: [0, 1500] },
  sources: ['observer'],
  examples: [
    {
      requestId: 'req-1',
      at: '2026-06-01T12:00:00.000Z',
      detail: {
        rootId: '7',
        replyId: '101',
        parentId: '100',
        repliesHost: 'replica-a',
        parentsHost: 'replica-b',
      },
    },
  ],
}

describe('buildReplyBeforeParentCard', () => {
  it('builds from a live entry', () => {
    const model = buildReplyBeforeParentCard(observerEntry, undefined)
    expect(model?.title).toBe('Reply seen before its parent')
    expect(model?.countLabel).toBe('37 reads affected')
    expect(model?.rateLabel).toBe('212 per 1,000 thread reads (expected 150–400)')
    expect(model?.denominatorNote).toBe('Observer reads of threads younger than 1.5 s')
    expect(model?.example?.threadId).toBe(7)
    expect(model?.staleNote).toBeUndefined()
  })

  it('uses cache with stale note when live entry is missing', () => {
    const model = buildReplyBeforeParentCard(undefined, {
      entry: observerEntry,
      at: '2026-06-01T12:04:31.000Z',
    })
    expect(model?.staleNote).toMatch(/Showing the last snapshot from/)
    expect(model?.staleNote).toMatch(/app unreachable/)
  })

  it('returns null without live entry or cache', () => {
    expect(buildReplyBeforeParentCard(undefined, undefined)).toBeNull()
  })

  it('shows incomplete banner when flagged', () => {
    const model = buildReplyBeforeParentCard(
      { ...observerEntry, detectionMayBeIncomplete: true },
      undefined,
    )
    expect(model?.incompleteBanner).toMatch(/load generator fell behind/)
  })

  it('formats equal-delay expected range as 0–5', () => {
    const entry: PhenomenonEntry = {
      ...observerEntry,
      baseRate: { perThousand: 2, denominator: 'all thread reads', reads: 1000 },
      expected: { minPerThousand: 0, maxPerThousand: 5 },
      cause: { replicaApplyDelayMs: [1500, 1500] },
    }
    const model = buildReplyBeforeParentCard(entry, undefined)
    expect(model?.rateLabel).toBe('2 per 1,000 thread reads (expected 0–5)')
  })
})

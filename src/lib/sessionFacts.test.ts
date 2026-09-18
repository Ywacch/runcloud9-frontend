import { describe, expect, it } from 'vitest'
import type { WsEvent } from '../editor-core/stores/metricsStore'
import {
  failoverPayloadFromFacts,
  mergeHighlightEvents,
  reduceSessionFacts,
} from './sessionFacts'

function promoteEvent(walBytesLost: string): WsEvent {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    type: 'action',
    source: 'chaos',
    kind: 'chaos_inject',
    component: 'db',
    title: 'Promote',
    description: 'promote_lagging_replica',
    detail: {
      scenario: 'promote_lagging_replica',
      promotedPod: 'postgres-replica-1',
      walBytesLost,
    },
  }
}

describe('reduceSessionFacts', () => {
  it('records failover from promotion chaos_inject', () => {
    const facts = reduceSessionFacts([promoteEvent('0')])
    const payload = failoverPayloadFromFacts(facts, 'db')
    expect(payload?.promotionEvent.description).toBe('promote_lagging_replica')
    expect(payload?.walBytesLost).toBe(0)
  })

  it('keeps worst-case walBytesLost on repeat events', () => {
    const facts = reduceSessionFacts([
      promoteEvent('0'),
      promoteEvent('4096'),
      {
        timestamp: '2026-01-01T00:00:10Z',
        type: 'invariant',
        source: 'chaos',
        component: 'db',
        title: 'Failover write loss',
        description: 'loss',
        rule: 'failover_write_loss',
        detail: { walBytesLost: '8192' },
      },
    ])
    const payload = failoverPayloadFromFacts(facts, 'db')
    expect(payload?.walBytesLost).toBe(8192)
  })

  it('merges session facts into highlight reel entries', () => {
    const merged = mergeHighlightEvents([], [promoteEvent('4096')])
    expect(merged.length).toBe(1)
    expect(merged[0].rule).toBe('promote_lagging_replica')
    expect(merged[0].component).toBe('db')
  })

  it('records partition CAP events', () => {
    const facts = reduceSessionFacts([
      {
        timestamp: '2026-01-01T00:00:00Z',
        type: 'invariant',
        source: 'detector',
        component: 'db',
        title: 'Stale reads',
        description: '',
        rule: 'partition_stale_reads',
      },
    ])
    expect(Object.keys(facts).some((k) => k.startsWith('partition:db:'))).toBe(true)
  })
})

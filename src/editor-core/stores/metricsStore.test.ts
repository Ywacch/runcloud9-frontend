import { beforeEach, describe, expect, it } from 'vitest'
import { latestPromotionChaosInjectEvent } from '../../lib/chaos'
import { useMetricsStore, type WsEvent } from './metricsStore'

describe('metricsStore event cap', () => {
  beforeEach(() => {
    useMetricsStore.setState({ events: [] })
  })

  it('keeps a promotion chaos_inject after 100 later events', () => {
    const promote: WsEvent = {
      timestamp: 't-promote',
      type: 'action',
      source: 'chaos',
      kind: 'chaos_inject',
      component: 'db',
      title: 'Promote replica',
      description: 'promote_replica',
      detail: { scenario: 'promote_replica', walBytesLost: '0' },
    }
    useMetricsStore.getState().pushEvents([promote])
    useMetricsStore.getState().pushEvents(
      Array.from({ length: 100 }, (_, i) => ({
        timestamp: `t-${i}`,
        type: 'action',
        source: 'runtime',
        title: `noise ${i}`,
        description: '',
      })),
    )
    const events = useMetricsStore.getState().events
    expect(events.length).toBe(100)
    expect(latestPromotionChaosInjectEvent(events)?.description).toBe(
      'promote_replica',
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  collectPredictions,
  consistencyInvariantPredictions,
  narrativeAppliesToTopology,
  preDeployNarrativeBody,
} from './storytellingPredictions'
import type { StorytellingSpec } from './storytellingTypes'

const storytelling: StorytellingSpec = {
  narrativeContext: {
    mq_backpressure: {
      cause:
        'Each post fans out to ~{worker.fanout_size_p99} followers. At {mq.produce_rate} posts/s, workers deliver ~{worker.redis_write_rate} Redis writes/s.',
      suggestion: 'Add more worker replicas to increase fan-out throughput.',
    },
    cache_hit_low: {
      cause: 'Sorted-set timelines can go cold under memory pressure.',
    },
  },
}

describe('storytellingPredictions', () => {
  it('hides mq_backpressure when canvas has no MQ/worker', () => {
    const cards = collectPredictions(storytelling, {
      hasLB: false,
      hasMQ: false,
      hasWorker: false,
      hasCache: true,
      hasDB: true,
      dbReadReplicas: 0,
      readConsistency: 'leader-only',
      cacheStrategy: 'timeline-store',
    })
    expect(cards.some((c) => c.id === 'mq_backpressure')).toBe(false)
    expect(cards.some((c) => c.id === 'cache_hit_low')).toBe(true)
  })

  it('shows mq_backpressure with static pre-deploy copy when async topology present', () => {
    const cards = collectPredictions(storytelling, {
      hasLB: true,
      hasMQ: true,
      hasWorker: true,
      hasCache: true,
      hasDB: true,
      dbReadReplicas: 0,
      readConsistency: 'leader-only',
      cacheStrategy: 'timeline-store',
    })
    const mq = cards.find((c) => c.id === 'mq_backpressure')
    expect(mq?.body).not.toContain('{worker')
    expect(mq?.body).toContain('message queue')
  })

  it('gates narrative rules by topology helper', () => {
    expect(
      narrativeAppliesToTopology('mq_backpressure', {
        hasLB: false,
        hasMQ: false,
        hasWorker: false,
        hasCache: true,
        hasDB: false,
        dbReadReplicas: 0,
        readConsistency: 'leader-only',
        cacheStrategy: '',
      }),
    ).toBe(false)
  })

  it('strips unreplaced placeholders from generic causes', () => {
    expect(
      preDeployNarrativeBody(
        'other_rule',
        'Rate is {mq.produce_rate} posts/s today.',
      ),
    ).toBe('Rate is … posts/s today.')
  })

  it('includes consistency invariant predictions when read replicas are present', () => {
    const cards = consistencyInvariantPredictions({
      hasLB: false,
      hasMQ: false,
      hasWorker: false,
      hasCache: false,
      hasDB: true,
      dbReadReplicas: 1,
      readConsistency: 'leader-only',
      cacheStrategy: 'cache-aside',
    })
    expect(cards.map((c) => c.id)).toEqual([
      'ryw_violation',
      'monotonic_violation',
    ])
  })

  it('hides cache_db_stale without cache on the canvas', () => {
    const cards = consistencyInvariantPredictions({
      hasLB: false,
      hasMQ: false,
      hasWorker: false,
      hasCache: false,
      hasDB: true,
      dbReadReplicas: 2,
      readConsistency: 'leader-only',
      cacheStrategy: 'cache-aside',
    })
    expect(cards.some((c) => c.id === 'cache_db_stale')).toBe(false)
  })

  it('shows cache_db_stale with DB and cache but no read replicas', () => {
    const cards = consistencyInvariantPredictions({
      hasLB: false,
      hasMQ: false,
      hasWorker: false,
      hasCache: true,
      hasDB: true,
      dbReadReplicas: 0,
      readConsistency: 'leader-only',
      cacheStrategy: 'cache-aside',
    })
    expect(cards.some((c) => c.id === 'cache_db_stale')).toBe(true)
  })
})

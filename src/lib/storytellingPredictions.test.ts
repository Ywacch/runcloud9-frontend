import { describe, expect, it } from 'vitest'
import {
  collectPredictions,
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
})

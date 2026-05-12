import { describe, expect, it } from 'vitest'
import { getRelevantTemplateMetrics } from './templateMetricsFilter'

describe('getRelevantTemplateMetrics', () => {
  const sample: Record<string, number> = {
    'worker.processed': 42,
    'mq.publish_total': 7,
    'feed.pull_rate': 5,
    'posts.total_sync': 3,
    'shortener.collisions': 1,
    'checkout.sync_total': 2,
    'redis.ops_per_sec': 99,
  }

  it('returns only worker.* for worker', () => {
    const out = getRelevantTemplateMetrics(sample, 'worker')
    expect(Object.keys(out)).toEqual(['worker.processed'])
  })

  it('returns only mq.* for mq', () => {
    const out = getRelevantTemplateMetrics(sample, 'mq')
    expect(Object.keys(out)).toEqual(['mq.publish_total'])
  })

  it('returns app prefixes for app-server', () => {
    const out = getRelevantTemplateMetrics(sample, 'app-server')
    expect(Object.keys(out).sort()).toEqual(
      [
        'checkout.sync_total',
        'feed.pull_rate',
        'posts.total_sync',
        'shortener.collisions',
      ].sort()
    )
  })

  it('returns redis.* for cache', () => {
    const out = getRelevantTemplateMetrics(sample, 'cache')
    expect(Object.keys(out)).toEqual(['redis.ops_per_sec'])
  })

  it('returns empty for db/lb or undefined metrics', () => {
    expect(getRelevantTemplateMetrics(sample, 'db')).toEqual({})
    expect(getRelevantTemplateMetrics(undefined, 'app-server')).toEqual({})
  })
})

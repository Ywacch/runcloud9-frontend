import { describe, expect, it } from 'vitest'
import {
  groupTemplateMetricDistributions,
  humanizeMetricPrefix,
  isConventionMetricKey,
} from './templateMetricDistributions'

describe('templateMetricDistributions', () => {
  it('groups quantile and rate keys by prefix without template-specific code', () => {
    const groups = groupTemplateMetricDistributions({
      'foo.bar_rate': 12.5,
      'foo.bar_p50': 0.01,
      'foo.bar_p95': 0.05,
      'foo.bar_p99': 0.08,
      'checkout.async_p95': 0.12,
    })

    expect(groups).toHaveLength(2)

    const foo = groups.find((g) => g.prefix === 'foo.bar')
    expect(foo).toMatchObject({
      label: 'Foo bar',
      rate: 12.5,
      p50Ms: 10,
      p95Ms: 50,
      p99Ms: 80,
    })

    const checkout = groups.find((g) => g.prefix === 'checkout.async')
    expect(checkout).toMatchObject({
      label: 'Checkout async',
      p95Ms: 120,
    })
  })

  it('humanizes dot-separated prefixes', () => {
    expect(humanizeMetricPrefix('feed.pull')).toBe('Feed pull')
    expect(humanizeMetricPrefix('worker.fanout_size')).toBe('Worker fanout size')
  })

  it('detects convention metric keys', () => {
    expect(isConventionMetricKey('feed.pull_p95')).toBe(true)
    expect(isConventionMetricKey('feed.pull_rate')).toBe(true)
    expect(isConventionMetricKey('feed.push_total')).toBe(false)
    expect(isConventionMetricKey('worker.processed')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import type { TopologyFlags } from './componentRole'
import { templateKpiRows } from './templateKpis'

const pullTopology: TopologyFlags = {
  hasMQ: false,
  hasWorker: false,
  hasCache: false,
  hasLB: true,
  cacheStrategy: 'cache-aside',
}

describe('templateKpiRows social-feed-pull', () => {
  it('returns pull telemetry rows when backend sends templateMetrics', () => {
    const rows = templateKpiRows(
      'social-feed-pull',
      {},
      {},
      {},
      null,
      {
        'feed.pull_rate': 12.5,
        'feed.pull_p95': 0.08,
        'posts.total_sync': 42,
        'feed.push_rate': 99,
        'worker.processed': 10,
      },
      pullTopology,
    )
    const labels = rows.map((r) => r.label)
    expect(labels).toContain('Feed reads/s (pull)')
    expect(labels).toContain('Feed read p95 (pull)')
    expect(labels).toContain('Posts written (sync)')
    expect(labels).not.toContain('Feed reads/s (push)')
    expect(labels.some((l) => l.includes('Fan-out'))).toBe(false)
  })

  it('returns empty for unknown template ids', () => {
    expect(templateKpiRows('unknown-template', {}, {}, {}, null, {}, pullTopology)).toEqual(
      [],
    )
  })
})

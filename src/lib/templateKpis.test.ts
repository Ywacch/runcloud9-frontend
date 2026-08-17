import { describe, expect, it } from 'vitest'
import type { TopologyFlags } from './componentRole'
import {
  hudKpiLabel,
  hudKpiRows,
  kpiChipIsAlert,
  templateKpiRows,
} from './templateKpis'

const pullTopology: TopologyFlags = {
  hasMQ: false,
  hasWorker: false,
  hasCache: false,
  hasLB: true,
  cacheStrategy: 'cache-aside',
}

const pushTopology: TopologyFlags = {
  hasMQ: true,
  hasWorker: true,
  hasCache: true,
  hasLB: true,
  cacheStrategy: 'push',
}

describe('templateKpiRows social-feed', () => {
  it('shows cumulative push feed reads when cache is present', () => {
    const rows = templateKpiRows(
      'social-feed',
      {},
      {},
      {},
      null,
      {
        'feed.push_rate': 4.2,
        'feed.push_total': 1280,
        'feed.push_p95': 0.05,
      },
      pushTopology,
    )
    const labels = rows.map((r) => r.label)
    expect(labels).toContain('Feed read (Redis) · reads/s')
    expect(labels).toContain('Feed read (Redis) · p95')
    expect(labels).toContain('Feed reads (push)')
    const total = rows.find((r) => r.label === 'Feed reads (push)')
    expect(total?.value).toBe('1,280')
  })

  it('hides push metrics when cache is absent', () => {
    const rows = templateKpiRows(
      'social-feed',
      {},
      {},
      {},
      null,
      {
        'feed.push_rate': 4.2,
        'feed.push_total': 1280,
      },
      pullTopology,
    )
    const labels = rows.map((r) => r.label)
    expect(labels).not.toContain('Feed read (Redis) · reads/s')
    expect(labels).not.toContain('Feed reads (push)')
  })
})

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
    expect(labels).toContain('Feed read (database) · reads/s')
    expect(labels).toContain('Feed read (database) · p95')
    expect(labels).toContain('Posts written (sync)')
    expect(labels).not.toContain('Feed read (Redis) · reads/s')
    expect(labels.some((l) => l.includes('Fan-out'))).toBe(false)
  })

  it('returns empty for unknown template ids', () => {
    expect(templateKpiRows('unknown-template', {}, {}, {}, null, {}, pullTopology)).toEqual(
      [],
    )
  })
})

describe('kpiChipIsAlert', () => {
  it('keeps error chips neutral at zero', () => {
    expect(
      kpiChipIsAlert({
        id: 'fanout',
        label: 'Fan-out errors',
        value: '0',
        numeric: 0,
        kind: 'error',
      }),
    ).toBe(false)
  })

  it('flags error chips when the value is above zero', () => {
    expect(
      kpiChipIsAlert({
        id: 'fanout',
        label: 'Fan-out errors',
        value: '12',
        numeric: 12,
        kind: 'error',
      }),
    ).toBe(true)
  })

  it('never alerts non-error chips', () => {
    expect(
      kpiChipIsAlert({ id: 'posts', label: 'Posts', value: '470', numeric: 470 }),
    ).toBe(false)
  })
})

describe('hudKpiLabel / hudKpiRows', () => {
  it('shortens inspector social-feed labels', () => {
    expect(hudKpiLabel('Posts written (async)')).toBe('Posts')
    expect(hudKpiLabel('Fan-out errors')).toBe('Fan-out errors')
  })

  it('uses explicit hudLabel on convention rows', () => {
    const rows = hudKpiRows([
      {
        id: 'rate',
        label: 'Feed read (Redis) · reads/s',
        value: '12/s',
        numeric: 12,
        hudLabel: 'Read/s · Redis',
      },
      {
        id: 'p95',
        label: 'Feed read (Redis) · p95',
        value: '40ms',
        numeric: 40,
        hudLabel: 'Read p95 · Redis',
      },
    ])
    expect(rows.map((r) => r.label)).toEqual(['Read/s · Redis', 'Read p95 · Redis'])
  })

  it('caps at 4 and keeps firing error metrics first', () => {
    const rows = hudKpiRows([
      { id: 'a', label: 'Posts written (async)', value: '5265', numeric: 5265 },
      {
        id: 'b',
        label: 'Feed read (Redis) · reads/s',
        value: '8/s',
        numeric: 8,
        hudLabel: 'Read/s · Redis',
      },
      { id: 'c', label: 'Feed reads (push)', value: '2866', numeric: 2866 },
      {
        id: 'd',
        label: 'Feed read (Redis) · p95',
        value: '2500ms',
        numeric: 2500,
        hudLabel: 'Read p95 · Redis',
      },
      {
        id: 'e',
        label: 'Fan-out errors',
        value: '161',
        numeric: 161,
        kind: 'error',
      },
      { id: 'f', label: 'Fan-out jobs done', value: '1304', numeric: 1304 },
    ])
    expect(rows).toHaveLength(4)
    expect(rows[0]?.label).toBe('Fan-out errors')
    expect(rows.map((r) => r.label)).toEqual([
      'Fan-out errors',
      'Posts',
      'Read/s · Redis',
      'Feed reads',
    ])
  })
})

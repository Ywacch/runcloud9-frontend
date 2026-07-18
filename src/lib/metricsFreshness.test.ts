import { describe, expect, it } from 'vitest'
import {
  containerFreshnessHint,
  parseComponentFreshness,
} from './metricsFreshness'

describe('parseComponentFreshness', () => {
  it('maps known tiers and lag from a component freshness fixture', () => {
    const freshness = parseComponentFreshness({
      throughput: {
        tier: 'rate',
        nominalLagSeconds: 15,
        source: 'prometheus_rate',
      },
      containerCpu: {
        tier: 'metrics_api',
        nominalLagSeconds: 45,
        source: 'metrics_api',
      },
      containerMem: {
        tier: 'metrics_api',
        nominalLagSeconds: 45,
        source: 'metrics_api',
      },
      connections: {
        tier: 'direct',
        nominalLagSeconds: 2,
        source: 'direct_poll',
      },
    })
    expect(freshness?.throughput?.tier).toBe('rate')
    expect(freshness?.containerCpu).toEqual({
      tier: 'metrics_api',
      nominalLagSeconds: 45,
      source: 'metrics_api',
    })
    expect(freshness?.connections?.nominalLagSeconds).toBe(2)
  })

  it('returns undefined when freshness is missing (legacy payloads)', () => {
    expect(parseComponentFreshness(undefined)).toBeUndefined()
    expect(parseComponentFreshness(null)).toBeUndefined()
    expect(parseComponentFreshness({})).toBeUndefined()
  })

  it('falls back unknown tiers instead of rejecting the payload', () => {
    const freshness = parseComponentFreshness({
      containerCpu: {
        tier: 'future_tier',
        nominalLagSeconds: 12,
        source: 'something_new',
      },
      queue: {
        tier: 'direct',
        nominalLagSeconds: 2,
      },
    })
    expect(freshness?.containerCpu?.tier).toBe('unknown')
    expect(freshness?.containerCpu?.source).toBe('something_new')
    expect(freshness?.queue?.tier).toBe('direct')
  })
})

describe('containerFreshnessHint', () => {
  it('labels metrics_api as delayed 15–60s', () => {
    expect(
      containerFreshnessHint({
        tier: 'metrics_api',
        nominalLagSeconds: 45,
        source: 'metrics_api',
      }),
    ).toMatch(/Delayed ~15–60s/)
  })

  it('labels estimated as allocated, not measured', () => {
    expect(
      containerFreshnessHint({
        tier: 'estimated',
        nominalLagSeconds: 0,
        source: 'kube_requests',
      }),
    ).toMatch(/Allocated, not measured/)
  })
})

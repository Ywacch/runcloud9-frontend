import { describe, expect, it } from 'vitest'
import {
  parseLoadgenIntervals,
  parseSteadyState,
  sampleFromWsPayload,
} from './metricsUiContract'

describe('metricsUiContract', () => {
  it('parseSteadyState reads snake_case medians', () => {
    const s = parseSteadyState({
      steady_p99_ms: 12.5,
      steady_rps: 48.2,
      steady_db_query_rate: 3.1,
      steady_cache_hit_rate: 87,
      snapshot_count: 42,
    })
    expect(s).toEqual({
      steadyP99Ms: 12.5,
      steadyRps: 48.2,
      steadyDbQueryRate: 3.1,
      steadyCacheHitRate: 87,
      snapshotCount: 42,
    })
  })

  it('parseLoadgenIntervals caps at 12 buckets', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      t: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      p99Ms: i,
      actualRps: i + 1,
    }))
    const out = parseLoadgenIntervals(rows)
    expect(out).toHaveLength(12)
    expect(out[0].actualRps).toBe(4)
  })

  it('sampleFromWsPayload converts app-server seconds to ms', () => {
    const sample = sampleFromWsPayload('2026-03-22T22:56:09Z', {
      'app-server': {
        requestRate: 48,
        p99Latency: 0.0125,
        cacheHits: 0.1,
        cacheMisses: 0.02,
      },
      db: { dbQueryRate: 3.5 },
    })
    expect(sample).not.toBeNull()
    expect(sample!.appP99Ms).toBeCloseTo(12.5)
    expect(sample!.appRps).toBe(48)
    expect(sample!.dbQueryRate).toBe(3.5)
    expect(sample!.cacheHits).toBe(0.1)
  })
})

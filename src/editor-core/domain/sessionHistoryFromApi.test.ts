import { describe, expect, it } from 'vitest'
import {
  mergePeakScalars,
  parseClientLatencyHistory,
  parsePeakFieldsFromMetricsSummary,
  parseSessionHistory,
} from './sessionHistoryFromApi'

describe('parseClientLatencyHistory', () => {
  it('returns validated intervals oldest to newest', () => {
    const parsed = parseClientLatencyHistory([
      { t: '2026-06-30T23:10:05.123456789Z', p99Ms: 42.5, actualRps: 48.2 },
      { t: '2026-06-30T23:10:10Z', p99Ms: '38', actualRps: 50 },
    ])
    expect(parsed).toEqual([
      { t: '2026-06-30T23:10:05.123456789Z', p99Ms: 42.5, actualRps: 48.2 },
      { t: '2026-06-30T23:10:10Z', p99Ms: 38, actualRps: 50 },
    ])
  })

  it('filters junk rows and returns null when empty', () => {
    expect(
      parseClientLatencyHistory([
        { p99Ms: -1, actualRps: 10 },
        { p99Ms: 10, actualRps: NaN },
        'bad',
      ]),
    ).toBeNull()
    expect(parseClientLatencyHistory(null)).toBeNull()
  })
})

describe('parseSessionHistory', () => {
  it('builds series and markers from snapshots', () => {
    const hist = [
      {
        components: {
          'app-server': {
            requestRate: 10,
            p99Latency: 0.05,
            errorRate: 0.1,
          },
          cache: { cacheHitsLast9m: 80, cacheMissesLast9m: 20 },
        },
        events: [{ type: 'action', title: 'start' }],
      },
      {
        components: {
          'app-server': {
            requestRate: 20,
            p99Latency: 0.1,
            errorRate: 0.2,
          },
          cache: { cacheHitsLast9m: 90, cacheMissesLast9m: 10 },
        },
      },
    ]
    const s = parseSessionHistory(hist)
    expect(s).not.toBeNull()
    expect(s!.rps).toEqual([10, 20])
    expect(s!.p99Ms[0]).toBeCloseTo(50)
    expect(s!.markers).toHaveLength(1)
    expect(s!.markers[0].index).toBe(0)
  })
})

describe('mergePeakScalars', () => {
  it('prefers API when keys exist, including zero', () => {
    const base = {
      peakRps: 99,
      peakP99: 99,
      totalRequests: 99,
      cacheHitRate: 50,
      errorRate: 0.05,
    }
    const merged = mergePeakScalars(base, {
      peak_rps: 0,
      peak_p99_ms: 12,
      total_requests: 0,
      cache_hit_rate: 0,
      error_rate: 0,
    })
    expect(merged.peakRps).toBe(0)
    expect(merged.peakP99).toBe(12)
    expect(merged.totalRequests).toBe(0)
    expect(merged.cacheHitRate).toBe(0)
    expect(merged.errorRate).toBe(0)
  })
})

describe('parsePeakFieldsFromMetricsSummary', () => {
  it('reads storage peak fields when present', () => {
    const p = parsePeakFieldsFromMetricsSummary({
      storage_read_rate: 500,
      storage_write_rate: 12,
      storage_read_latency_ms: 3,
      storage_write_latency_ms: 8,
      storage_utilization_pct: 72,
      storage_error_rate: 0.05,
    })
    expect(p.storagePeaks).toEqual({
      readRate: 500,
      writeRate: 12,
      readLatencyMs: 3,
      writeLatencyMs: 8,
      utilizationPct: 72,
      errorRate: 0.05,
    })
  })
})

import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../store/metricsStore'
import { computeHealthState } from './healthThresholds'

function bucket(partial: Partial<MetricsBucket>): MetricsBucket {
  return {
    cpuUsage: 0,
    cpuPercent: 0,
    memoryBytes: 0,
    memPercent: 0,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 0,
    memoryLimit: 0,
    requestRate: 0,
    errorRate: 0,
    totalRequests: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    avgLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitsLast9m: 0,
    cacheMissesLast9m: 0,
    dbQueryRate: 0,
    dbActiveConnections: 0,
    maxConnections: 0,
    activeConnections: 0,
    lbConnectionLimit: 0,
    queueDepth: 0,
    produceRate: 0,
    consumeRate: 0,
    messagesReady: 0,
    messagesUnacked: 0,
    mqMemoryUsed: 0,
    mqMemoryLimit: 0,
    mqSaturationRatio: 0,
    workerSaturation: 0,
    redisMaxClients: 0,
    perBackendRps: {},
    lbAlgorithm: '',
    lbBackends: [],
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...partial,
  }
}

describe('computeHealthState', () => {
  it('returns idle without metrics', () => {
    expect(computeHealthState(undefined, 'healthy')).toBe('idle')
  })

  it('returns healthy for low real CPU/mem (0–100 scale)', () => {
    expect(
      computeHealthState(
        bucket({ cpuPercent: 8, memPercent: 5 }),
        'healthy',
      ),
    ).toBe('healthy')
    expect(
      computeHealthState(
        bucket({ cpuPercent: 79, memPercent: 79 }),
        'healthy',
      ),
    ).toBe('healthy')
  })

  it('returns warning above 80% CPU or memory', () => {
    expect(
      computeHealthState(bucket({ cpuPercent: 81, memPercent: 10 }), 'healthy'),
    ).toBe('warning')
    expect(
      computeHealthState(bucket({ cpuPercent: 10, memPercent: 81 }), 'healthy'),
    ).toBe('warning')
  })

  it('returns error for degraded status or high error rate', () => {
    expect(computeHealthState(bucket({ cpuPercent: 5 }), 'degraded')).toBe(
      'error',
    )
    expect(
      computeHealthState(
        bucket({ cpuPercent: 5, errorRate: 0.02 }),
        'healthy',
      ),
    ).toBe('error')
  })
})

import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../stores/metricsStore'
import { lerpMetricsBucket } from './interpolate'

function bucket(partial: Partial<MetricsBucket> = {}): MetricsBucket {
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
    totalErrors9m: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    p99Latency9m: 0,
    avgLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitsLast9m: 0,
    cacheMissesLast9m: 0,
    dbQueryRate: 0,
    dbTotalQueries: 0,
    dbQueryLatency: 0,
    dbQuerySource: '',
    dbActiveConnections: 0,
    maxConnections: 0,
    storageEngine: '',
    storageRole: '',
    storageIo: null,
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
    podReplicas: [],
    backendPods: [],
    backendReplicas: null,
    runtimeHealth: null,
    layers: [],
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...partial,
  }
}

describe('lerpMetricsBucket', () => {
  it('returns endpoints at t=0 and t=1', () => {
    const a = bucket({ requestRate: 10, p99Latency: 100 })
    const b = bucket({ requestRate: 30, p99Latency: 200 })
    const at0 = lerpMetricsBucket(a, b, 0, 1000)
    const at1 = lerpMetricsBucket(a, b, 1, 2000)
    expect(at0.requestRate).toBe(10)
    expect(at0.p99Latency).toBe(100)
    expect(at1.requestRate).toBe(30)
    expect(at1.p99Latency).toBe(200)
  })

  it('lerps midpoints at t=0.5', () => {
    const a = bucket({ requestRate: 0, errorRate: 0.1 })
    const b = bucket({ requestRate: 100, errorRate: 0.3 })
    const mid = lerpMetricsBucket(a, b, 0.5, 1500)
    expect(mid.requestRate).toBe(50)
    expect(mid.errorRate).toBeCloseTo(0.2)
  })

  it('snaps string fields from later sample at t>=0.5', () => {
    const a = bucket({ lbAlgorithm: 'round-robin' })
    const b = bucket({ lbAlgorithm: 'least-conn' })
    expect(lerpMetricsBucket(a, b, 0.6, 0).lbAlgorithm).toBe('least-conn')
    expect(lerpMetricsBucket(a, b, 0.4, 0).lbAlgorithm).toBe('round-robin')
  })

  it('zeros dbQueryRate when interpolated source is none', () => {
    const a = bucket({ dbQueryRate: 50, dbQuerySource: 'app' })
    const b = bucket({ dbQueryRate: 80, dbQuerySource: 'none' })
    const mid = lerpMetricsBucket(a, b, 0.75, 0)
    expect(mid.dbQuerySource).toBe('none')
    expect(mid.dbQueryRate).toBe(0)
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  bucketLatencyField,
  bucketLatencyHistorySeries,
  bucketSessionQuantileAvailable,
  isLatencyQuantile,
  readLatencyQuantile,
  writeLatencyQuantile,
} from './latencyQuantile'

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
    totalErrors9m: 0,
    p50Latency: 10,
    p95Latency: 30,
    p99Latency: 50,
    p50Latency9m: 11,
    p95Latency9m: 31,
    p99Latency9m: 51,
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

describe('latencyQuantile helpers', () => {
  it('validates quantile strings', () => {
    expect(isLatencyQuantile('p95')).toBe(true)
    expect(isLatencyQuantile('p99')).toBe(true)
    expect(isLatencyQuantile('avg')).toBe(false)
  })

  it('reads and writes localStorage preference', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    })
    writeLatencyQuantile('p95')
    expect(readLatencyQuantile()).toBe('p95')
    writeLatencyQuantile('p99')
    vi.unstubAllGlobals()
  })

  it('picks live and session bucket fields by quantile', () => {
    const m = bucket({})
    expect(bucketLatencyField(m, 'p50', 'live')).toBe(10)
    expect(bucketLatencyField(m, 'p95', 'live')).toBe(30)
    expect(bucketLatencyField(m, 'p99', 'live')).toBe(50)
    expect(bucketLatencyField(m, 'p50', 'session')).toBe(11)
    expect(bucketLatencyField(m, 'p95', 'session')).toBe(31)
    expect(bucketLatencyField(m, 'p99', 'session')).toBe(51)
  })

  it('builds history series for each quantile', () => {
    const history = [
      bucket({ p50Latency: 1, p95Latency: 2, p99Latency: 3 }),
      bucket({ p50Latency: 4, p95Latency: 5, p99Latency: 6 }),
    ]
    expect(bucketLatencyHistorySeries(history, 'p50')).toEqual([1, 4])
    expect(bucketLatencyHistorySeries(history, 'p95')).toEqual([2, 5])
    expect(bucketLatencyHistorySeries(history, 'p99')).toEqual([3, 6])
  })

  it('detects session quantile availability', () => {
    expect(bucketSessionQuantileAvailable(bucket({}), 'p99')).toBe(true)
    expect(bucketSessionQuantileAvailable(bucket({ p50Latency9m: 0, p50Latency: 0 }), 'p50')).toBe(
      false,
    )
  })
})

import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { fmtErrorRate } from './format'
import {
  cacheHeadlines,
  cacheHitRateDisplay,
  dbQueryHeadline,
  feedPushHeadline,
  podCpuPercent,
  podMemPercent,
  redHeadlines,
  replicaListRows,
  storageIoThroughputFields,
} from './metricTimeframe'

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
    requestRate: 100,
    errorRate: 0.02,
    totalRequests: 16_240,
    totalErrors9m: 12,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 42,
    p99Latency9m: 55,
    avgLatency: 0,
    cacheHits: 45,
    cacheMisses: 2,
    cacheHitsLast9m: 4216,
    cacheMissesLast9m: 205,
    dbQueryRate: 10,
    dbTotalQueries: 9000,
    dbQueryLatency: 0,
    dbQuerySource: 'app',
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
    podCount: 1,
    lastUpdated: 0,
    qps: 100,
    ...partial,
  }
}

describe('redHeadlines', () => {
  it('uses live rates in live mode', () => {
    const h = redHeadlines(bucket({}), 'live', fmtErrorRate)
    expect(h.throughputLabel).toBe('Request rate')
    expect(h.throughputDisplay).toContain('100')
    expect(h.latencyMs).toBe(42)
    expect(h.errorLabel).toBe('Error rate')
  })

  it('uses 9m totals in session mode', () => {
    const h = redHeadlines(bucket({}), 'session', fmtErrorRate)
    expect(h.throughputLabel).toContain('9m')
    expect(h.throughputDisplay).toContain('16,240')
    expect(h.errorDisplay).toBe('12')
    expect(h.latencyMs).toBe(55)
  })
})

describe('cacheHeadlines', () => {
  it('computes session hit rate from 9m totals', () => {
    const h = cacheHeadlines(bucket({}), 'session', (n) => String(n))
    expect(cacheHitRateDisplay(h.hitRatePct)).toContain('%')
    expect(h.throughputDisplay).toContain('4,216')
  })
})

describe('dbQueryHeadline', () => {
  it('switches label by timeframe', () => {
    expect(dbQueryHeadline(bucket({}), 'live').label).toBe('Query rate')
    expect(dbQueryHeadline(bucket({}), 'session').sessionTotal).toBe(9000)
  })
})

describe('feedPushHeadline', () => {
  it('shows cache query total in session mode', () => {
    const h = feedPushHeadline(bucket({}), 'session', 99, (n) => String(n))
    expect(h.label).toBe('Cache queries (9m)')
    expect(h.display).toBe('4,421')
  })

  it('shows live push rate when available', () => {
    const h = feedPushHeadline(bucket({}), 'live', 12.5, (n) => String(n))
    expect(h.label).toBe('Feed reads (push)')
    expect(h.display).toBe('12.5/s')
  })
})

describe('storageIoThroughputFields', () => {
  it('uses session totals when present on storageIo', () => {
    const fields = storageIoThroughputFields(
      bucket({
        storageIo: {
          readRate: 11,
          writeRate: 11634,
          readTotal9m: 5940,
          writeTotal9m: 6_282_360,
          unit: 'ops/s',
          readLabel: 'ZREVRANGE commands/s',
          writeLabel: 'ZADD/ZREMRANGE commands/s',
          readLatency: 0,
          writeLatency: 0,
          bytesUsed: 0,
          bytesLimit: 0,
          errorRate: 0,
          source: 'redis_exporter',
        },
      }),
      'session',
      'ZREVRANGE commands/s',
      'ZADD/ZREMRANGE commands/s',
      (n) => String(n),
    )
    expect(fields.readValue).toBe('5,940')
    expect(fields.writeValue).toBe('6,282,360')
  })
})

describe('podCpuPercent', () => {
  it('computes percent from cores used and limit', () => {
    expect(podCpuPercent(0.1, 0.125)).toBe(80)
  })
})

describe('podMemPercent', () => {
  it('computes percent from bytes used and limit', () => {
    expect(podMemPercent(134_217_728, 268_435_456)).toBe(50)
  })
})

describe('replicaListRows', () => {
  it('formats session totals with share percent', () => {
    const rows = replicaListRows(
      [
        {
          name: 'pod-a',
          ready: true,
          requestRate: 50,
          p99LatencyMs: 40,
          totalRequests: 7500,
          cpuUsage: 0.1,
          errorRate: 0,
          memoryBytes: 0,
        },
        {
          name: 'pod-b',
          ready: true,
          requestRate: 50,
          p99LatencyMs: 42,
          totalRequests: 2500,
          cpuUsage: 0.05,
          errorRate: 0,
          memoryBytes: 0,
        },
      ],
      'session',
      { cpuLimitCores: 0.125 },
    )
    expect(rows[0]?.primaryText).toContain('7,500')
    expect(rows[0]?.primaryText).toContain('75%')
    expect(rows[0]?.cpuPct).toBe(80)
  })

  it('uses cpu limit for live replica CPU display', () => {
    const rows = replicaListRows(
      [
        {
          name: 'app-server-abc',
          ready: true,
          requestRate: 77,
          p99LatencyMs: 2500,
          totalRequests: 0,
          cpuUsage: 0.1025,
          errorRate: 0,
          memoryBytes: 134_217_728,
        },
      ],
      'live',
      { cpuLimitCores: 0.125, memoryLimitBytes: 268_435_456 },
    )
    expect(rows[0]?.cpuPct).toBe(82)
    expect(rows[0]?.memPct).toBe(50)
  })
})

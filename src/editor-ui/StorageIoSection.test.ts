import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  ComputeInstanceSection,
  DbConsistencySection,
  DbLoadSection,
  formatConsistencyViolation,
} from './StorageIoSection'

function dbBucket(
  consistency?: MetricsBucket['consistency'],
  extras: Partial<MetricsBucket> = {},
): MetricsBucket {
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
    storageEngine: 'postgresql',
    storageRole: 'primary',
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
    consistency,
    podCount: 1,
    lastUpdated: 0,
    qps: 0,
    ...extras,
  }
}

describe('formatConsistencyViolation', () => {
  it('formats OK and violation counts', () => {
    expect(formatConsistencyViolation(0)).toBe('OK')
    expect(formatConsistencyViolation(1)).toBe('1 violation')
    expect(formatConsistencyViolation(3)).toBe('3 violations')
  })
})

describe('DbConsistencySection', () => {
  it('renders nothing when consistency is absent', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, { m: dbBucket(undefined) }),
    )
    expect(html).toBe('')
  })

  it('renders OK state and zero staleness', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 0,
          replicaStalenessVersions: 0,
        }),
      }),
    )
    expect(html).toContain('Consistency probes')
    expect(html).toContain('Observer canary for replica lag')
    expect(html).toContain('sampled student reads')
    expect(html).not.toContain('when available')
    expect(html).toContain('Read-your-writes')
    expect(html).toContain('OK')
    expect(html).toContain('0 versions')
  })

  it('renders violation counts and probe error', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          rywViolations: 2,
          monotonicViolations: 1,
          cacheDbStale: 0,
          replicaStalenessVersions: 4,
          lastProbeError: 'dial replica: connection refused',
        }),
      }),
    )
    expect(html).toContain('2 violations')
    expect(html).toContain('1 violation')
    expect(html).toContain('4 versions')
    expect(html).toContain('dial replica: connection refused')
  })

  it('renders cache evidence and view trace when present', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 1,
          replicaStalenessVersions: 0,
          lastCacheKey: 'product:7',
          lastCacheServed: '5',
          lastCacheTruth: '2',
          lastCacheRequestID: 'req-stale-1',
        }),
      }),
    )
    expect(html).toContain('product:7')
    expect(html).toContain('served 5')
    expect(html).toContain('db 2')
    expect(html).toContain('View trace')
  })

  it('hides cache evidence line when key is absent', () => {
    const html = renderToStaticMarkup(
      createElement(DbConsistencySection, {
        m: dbBucket({
          rywViolations: 0,
          monotonicViolations: 0,
          cacheDbStale: 1,
          replicaStalenessVersions: 0,
        }),
      }),
    )
    expect(html).not.toContain('View trace')
    expect(html).not.toContain('· db ')
  })
})

const instancePod: PodReplicaMetrics = {
  name: 'app-server-roll-a',
  ready: true,
  requestRate: 25,
  p99LatencyMs: 42,
  p50LatencyMs: 10,
  p95LatencyMs: 30,
  p99Latency9mMs: 55,
  totalRequests: 9000,
  totalErrors9m: 12,
  cpuUsage: 0.2,
  errorRate: 0.5,
  memoryBytes: 128 * 1024 * 1024,
}

describe('ComputeInstanceSection timeframe', () => {
  it('shows live request rate and error rate', () => {
    const html = renderToStaticMarkup(
      createElement(ComputeInstanceSection, {
        pod: instancePod,
        m: dbBucket(),
        view: { timeframe: 'live', showGraphs: true },
      }),
    )
    expect(html).toContain('Request rate')
    expect(html).toContain('Error rate')
    expect(html).toContain('25')
  })

  it('shows session totals and errors in session mode', () => {
    const html = renderToStaticMarkup(
      createElement(ComputeInstanceSection, {
        pod: instancePod,
        m: dbBucket(),
        view: { timeframe: 'session', showGraphs: true },
      }),
    )
    expect(html).toContain('Total requests')
    expect(html).toContain('9,000')
    expect(html).toContain('Errors')
    expect(html).toContain('12')
    expect(html).toContain('Latency p99')
  })
})

const postgresIo = {
  readRate: 27216,
  writeRate: 8,
  readTotal9m: 1_264_086,
  writeTotal9m: 3576,
  unit: 'rows/s',
  readLabel: 'Rows scanned/s',
  writeLabel: 'Rows written/s',
  readLatency: 0,
  writeLatency: 0,
  bytesUsed: 0,
  bytesLimit: 0,
  errorRate: 0,
  source: 'postgres_exporter',
}

describe('DbLoadSection', () => {
  const liveView = { timeframe: 'live' as const, showGraphs: true }
  const sessionView = { timeframe: 'session' as const, showGraphs: true }

  it('shows live rates with /s labels', () => {
    const html = renderToStaticMarkup(
      createElement(DbLoadSection, {
        m: dbBucket(undefined, { storageIo: postgresIo, dbQueryRate: 50 }),
        dbQueryRate: 50,
        templateMetrics: {},
        view: liveView,
      }),
    )
    expect(html).toContain('Rows scanned/s')
    expect(html).toContain('Rows written/s')
    expect(html).toMatch(/27[,.]?216\/s/)
    expect(html).toContain('/s')
  })

  it('shows session totals without /s labels or 10s graphs', () => {
    const html = renderToStaticMarkup(
      createElement(DbLoadSection, {
        m: dbBucket(undefined, { storageIo: postgresIo, dbQueryRate: 50 }),
        dbQueryRate: 50,
        templateMetrics: {},
        view: sessionView,
      }),
    )
    expect(html).toContain('Rows scanned')
    expect(html).not.toContain('Rows scanned/s')
    expect(html).toContain('Rows written')
    expect(html).not.toContain('Rows written/s')
    expect(html).toContain('1,264,086')
    expect(html).toContain('3,576')
    expect(html).not.toContain('27,216/s')
    expect(html).not.toContain('10s · /s')
    expect(html).not.toContain('Why reads look high')
  })
})

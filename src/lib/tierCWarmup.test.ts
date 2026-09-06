import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  TIER_C_WARMUP_MS,
  dbClusterResourceHelp,
  formatDbClusterResourceLabels,
  isTierCResource,
  isTierCWarmingUp,
  shouldShowDbClusterUtilizationCharts,
} from '../editor-ui/inspectorPanelUi'

function bucket(partial: Partial<MetricsBucket>): MetricsBucket {
  return {
    cpuUsage: 0.125,
    cpuPercent: 100,
    memoryBytes: 207_618_048,
    memPercent: 77,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 0.125,
    memoryLimit: 268_435_456,
    cpuSource: 'metrics_api',
    memSource: 'metrics_api',
    requestRate: 0,
    errorRate: 0,
    totalRequests: 0,
    totalErrors9m: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    p50Latency9m: 0,
    p95Latency9m: 0,
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

describe('isTierCResource', () => {
  it('is true when either source is metrics_api', () => {
    expect(isTierCResource(bucket({ cpuSource: 'metrics_api' }))).toBe(true)
    expect(isTierCResource(bucket({ memSource: 'metrics_api', cpuSource: undefined }))).toBe(
      true,
    )
    expect(isTierCResource(bucket({ cpuSource: 'cadvisor', memSource: 'cadvisor' }))).toBe(
      false,
    )
  })
})

describe('isTierCWarmingUp', () => {
  it('is true within the warmup window', () => {
    const start = 1_000_000
    expect(isTierCWarmingUp(start, start + TIER_C_WARMUP_MS - 1)).toBe(true)
    expect(isTierCWarmingUp(start, start + TIER_C_WARMUP_MS)).toBe(false)
    expect(isTierCWarmingUp(null, start)).toBe(false)
  })
})

describe('formatDbClusterResourceLabels', () => {
  it('shows real utilization during warmup with help elsewhere', () => {
    const labels = formatDbClusterResourceLabels(bucket({}), 100, 77, true)
    expect(labels.cpu).toBe('100%')
    expect(labels.mem).toContain('77%')
  })

  it('falls back to normal labels after warmup', () => {
    const labels = formatDbClusterResourceLabels(bucket({}), 42, 77, false)
    expect(labels.cpu).toBe('42%')
  })

  it('estimated fallback takes precedence over warmup', () => {
    const labels = formatDbClusterResourceLabels(
      bucket({ cpuIsEstimated: true, memIsEstimated: true }),
      100,
      77,
      true,
    )
    expect(labels.cpu).toBe('Limit 125m')
    expect(labels.mem).toBe('Limit 256 MB')
  })
})

describe('shouldShowDbClusterUtilizationCharts', () => {
  it('shows charts during warmup and hides only when estimated', () => {
    expect(shouldShowDbClusterUtilizationCharts(bucket({}), true)).toBe(true)
    expect(shouldShowDbClusterUtilizationCharts(bucket({}), false)).toBe(true)
    expect(shouldShowDbClusterUtilizationCharts(bucket({ cpuIsEstimated: true }), false)).toBe(
      false,
    )
  })
})

describe('dbClusterResourceHelp', () => {
  it('prefers alloc help when estimated', () => {
    expect(dbClusterResourceHelp(bucket({ cpuIsEstimated: true }), true)).toMatch(
      /Allocated, not measured/,
    )
  })

  it('shows warmup help during tier C warmup', () => {
    expect(dbClusterResourceHelp(bucket({}), true)).toMatch(/about a minute/)
  })

  it('shows metrics API freshness after warmup', () => {
    expect(dbClusterResourceHelp(bucket({}), false)).toMatch(/Delayed ~15–60s/)
  })
})

import { describe, expect, it } from 'vitest'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { clampPercent, FMT_UTIL_UNKNOWN } from './format'
import {
  formatDbClusterResourceLabels,
  formatResourceLabels,
  tooltipMemoryDisplay,
} from '../editor-ui/inspectorPanelUi'

function bucket(partial: Partial<MetricsBucket> = {}): MetricsBucket {
  return {
    cpuUsage: 0.125,
    cpuPercent: 8,
    memoryBytes: 119_400_000,
    memPercent: 47,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 0.125,
    memoryLimit: 268_435_456,
    cpuSource: 'metrics_api',
    memSource: 'metrics_api',
    requestRate: 6,
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

describe('clampPercent', () => {
  it('keeps 0–100 bucket values without scaling', () => {
    expect(clampPercent(8)).toBe(8)
    expect(clampPercent(47)).toBe(47)
    expect(clampPercent(100)).toBe(100)
  })

  it('clamps out-of-range values', () => {
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent(150)).toBe(100)
    expect(clampPercent(undefined)).toBe(0)
  })
})

describe('tooltip resource labels', () => {
  it('formats low utilization without inflating to 100%', () => {
    const cpuPct = clampPercent(bucket().cpuPercent)
    const memPct = clampPercent(bucket().memPercent)
    const labels = formatResourceLabels(bucket(), cpuPct, memPct)
    expect(labels.cpu).toBe('8%')
    expect(labels.mem).toContain('47%')
    expect(labels.mem).not.toContain('~15–60s')
  })

  it('shows percent-only memory in canvas tooltip when live', () => {
    const memPct = clampPercent(bucket().memPercent)
    const labels = formatResourceLabels(bucket(), 8, memPct)
    expect(tooltipMemoryDisplay(bucket(), memPct, labels.mem)).toBe('47%')
    expect(labels.mem).toContain('MB')
  })

  it('shows em dash for memory percent in canvas tooltip when limit is unknown', () => {
    const b = bucket({ memoryLimit: 0 })
    const memPct = clampPercent(b.memPercent)
    const labels = formatResourceLabels(b, 8, memPct)
    expect(tooltipMemoryDisplay(b, memPct, labels.mem)).toBe(FMT_UTIL_UNKNOWN)
  })

  it('keeps full memory label in tooltip when estimated', () => {
    const b = bucket({ memIsEstimated: true })
    const labels = formatResourceLabels(b, 0, 0)
    expect(tooltipMemoryDisplay(b, 0, labels.mem)).toBe('Limit 256 MB')
  })

  it('keeps real utilization labels for database tier C during warmup', () => {
    const cpuPct = clampPercent(bucket().cpuPercent)
    const memPct = clampPercent(bucket().memPercent)
    const labels = formatDbClusterResourceLabels(bucket(), cpuPct, memPct, true)
    expect(labels.cpu).toBe('8%')
    expect(labels.mem).toContain('47%')
  })
})

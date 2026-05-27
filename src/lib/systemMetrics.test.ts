import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../store/canvasStore'
import type { LiveLoadgenState, MetricsBucket } from '../store/metricsStore'
import { computeSystemAggregates, computeThroughputRps } from './systemMetrics'

const nodes: Record<string, CanvasNode> = {
  c1: {
    id: 'c1',
    type: 'client',
    position: [0, 0, 0],
    label: 'Client',
    config: {},
    status: 'healthy',
  },
  app1: {
    id: 'app1',
    type: 'compute',
    position: [1, 0, 0],
    label: 'App',
    config: {},
    status: 'healthy',
  },
}

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

describe('computeSystemAggregates', () => {
  it('maxes p99 and weights errors by request rate', () => {
    const metrics: Record<string, MetricsBucket> = {
      app1: bucket({
        requestRate: 100,
        errorRate: 0.1,
        p99Latency: 50,
      }),
      db1: bucket({
        requestRate: 10,
        errorRate: 0,
        p99Latency: 200,
      }),
    }
    const n: Record<string, CanvasNode> = {
      ...nodes,
      db1: {
        id: 'db1',
        type: 'database',
        position: [2, 0, 0],
        label: 'DB',
        config: {},
        status: 'healthy',
      },
    }
    const a = computeSystemAggregates(metrics, n, null, 'live', {}, false)
    expect(a.systemP99Ms).toBe(200)
    expect(a.systemErrorRate).toBeCloseTo((100 * 0.1 + 10 * 0) / 110, 5)
    expect(a.hasComponentMetrics).toBe(true)
  })

  it('ignores client nodes in aggregates', () => {
    const metrics: Record<string, MetricsBucket> = {
      c1: bucket({ requestRate: 999, errorRate: 0.5, p99Latency: 9999 }),
      app1: bucket({ requestRate: 1, errorRate: 0, p99Latency: 10 }),
    }
    const a = computeSystemAggregates(metrics, nodes, null, 'live', {}, false)
    expect(a.systemP99Ms).toBe(10)
    expect(a.systemErrorRate).toBe(0)
  })
})

describe('computeThroughputRps', () => {
  it('uses loadgen when active in live mode', () => {
    const loadgen: LiveLoadgenState = {
      active: true,
      currentRps: 42,
      targetRps: 42,
      actualRps: 42,
      intervalActualRps: 0,
      intervalP99Ms: 0,
      recentIntervals: [],
      totalRequests: 0,
      successRate: 100,
      durationSeconds: 0,
      elapsedSeconds: 0,
    }
    const r = computeThroughputRps({}, nodes, loadgen, 'live', {}, false)
    expect(r).toBe(42)
  })
})

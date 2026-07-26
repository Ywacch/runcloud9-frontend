import { describe, expect, it } from 'vitest'
import { nextHealthVisualForSvgNode } from './syncLiveHealth'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../../editor-core/stores/metricsStore'

function node(partial?: Partial<CanvasNode>): CanvasNode {
  return {
    id: 'n1',
    type: 'compute',
    position: [0, 0, 0],
    label: 'T1',
    status: 'healthy',
    config: {},
    ...partial,
  }
}

function metrics(partial: Partial<MetricsBucket>): MetricsBucket {
  return {
    cpuUsage: 0,
    cpuPercent: 0,
    memoryBytes: 0,
    memPercent: 0,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 1,
    memoryLimit: 1024,
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
    lastUpdated: Date.now(),
    qps: 0,
    ...partial,
  } as MetricsBucket
}

describe('nextHealthVisualForSvgNode', () => {
  it('keeps demo health in design mode', () => {
    expect(
      nextHealthVisualForSvgNode({
        canvasNode: node(),
        mode: 'design',
        metrics: undefined,
        isTargetActive: () => false,
        prevHealth: 'warning',
        leftMetricsMode: false,
      }),
    ).toBe('warning')
  })

  it('clears health when leaving live/sim', () => {
    expect(
      nextHealthVisualForSvgNode({
        canvasNode: node(),
        mode: 'design',
        metrics: undefined,
        isTargetActive: () => false,
        prevHealth: 'error',
        leftMetricsMode: true,
      }),
    ).toBe('off')
  })

  it('derives warning from high CPU in simulate', () => {
    expect(
      nextHealthVisualForSvgNode({
        canvasNode: node(),
        mode: 'simulate',
        metrics: metrics({ cpuPercent: 90, cpuIsEstimated: false }),
        isTargetActive: () => false,
        prevHealth: 'off',
        leftMetricsMode: false,
      }),
    ).toBe('warning')
  })

  it('prefers chaos over metrics in live', () => {
    expect(
      nextHealthVisualForSvgNode({
        canvasNode: node(),
        mode: 'live',
        metrics: metrics({ cpuPercent: 10 }),
        isTargetActive: () => true,
        prevHealth: undefined,
        leftMetricsMode: false,
      }),
    ).toBe('chaos')
  })
})

import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { lbBackendResourceLimits, sumPodRequestRates } from './lbInspectorMetrics'

describe('sumPodRequestRates', () => {
  it('sums positive per-pod request rates', () => {
    expect(
      sumPodRequestRates([
        { name: 'a', ready: true, requestRate: 436, p99LatencyMs: 0, totalRequests: 0, cpuUsage: 0, errorRate: 0, memoryBytes: 0 },
        { name: 'b', ready: true, requestRate: 444, p99LatencyMs: 0, totalRequests: 0, cpuUsage: 0, errorRate: 0, memoryBytes: 0 },
        { name: 'c', ready: true, requestRate: 434, p99LatencyMs: 0, totalRequests: 0, cpuUsage: 0, errorRate: 0, memoryBytes: 0 },
      ]),
    ).toBe(1314)
  })
})

describe('lbBackendResourceLimits', () => {
  const lb: CanvasNode = {
    id: 'lb-1',
    type: 'load_balancer',
    label: 'LB',
    position: [0, 0, 0],
    status: 'healthy',
    config: {},
  }
  const app: CanvasNode = {
    id: 'app-1',
    type: 'compute',
    label: 'App',
    position: [0, 0, 0],
    status: 'healthy',
    config: {},
  }
  const edge: CanvasEdge = {
    id: 'e1',
    sourceId: 'lb-1',
    targetId: 'app-1',
    protocol: 'http',
    animated: false,
  }

  it('reads limits from the connected compute backend', () => {
    const limits = lbBackendResourceLimits(
      'lb-1',
      { e1: edge },
      { 'lb-1': lb, 'app-1': app },
      {
        'lb-1': { cpuLimit: 0.25, memoryLimit: 128 * 1024 * 1024 } as MetricsBucket,
        'app-1': { cpuLimit: 3, memoryLimit: 1536 * 1024 * 1024 } as MetricsBucket,
      },
    )
    expect(limits.cpuLimitCores).toBe(3)
    expect(limits.memoryLimitBytes).toBe(1536 * 1024 * 1024)
  })

  it('returns zero limits when no compute backend is wired', () => {
    const limits = lbBackendResourceLimits('lb-1', {}, { 'lb-1': lb }, {})
    expect(limits).toEqual({ cpuLimitCores: 0, memoryLimitBytes: 0 })
  })
})

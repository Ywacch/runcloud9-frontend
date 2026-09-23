import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  lbBackendResourceLimits,
  lbBackendSkewLabel,
  lbBackendTableRows,
  lbInspectorBackendPods,
  sumPodRequestRates,
} from './lbInspectorMetrics'

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

describe('lbInspectorBackendPods', () => {
  it('prefers backendPods over perBackendRps', () => {
    const pods = lbInspectorBackendPods({
      backendPods: [
        {
          name: 'app-roll-a',
          ready: true,
          requestRate: 58,
          p99LatencyMs: 5,
          totalRequests: 100,
          cpuUsage: 0.4,
          errorRate: 0,
          memoryBytes: 0,
        },
      ],
      perBackendRps: { 'app-roll-b': 42 },
    } as MetricsBucket)
    expect(pods).toHaveLength(1)
    expect(pods[0]?.name).toBe('app-roll-a')
  })

  it('falls back to perBackendRps when backendPods is empty', () => {
    const pods = lbInspectorBackendPods({
      backendPods: [],
      perBackendRps: { 'app-roll-a': 58, 'app-roll-b': 42 },
    } as MetricsBucket)
    expect(pods.map((pod) => pod.name).sort()).toEqual(['app-roll-a', 'app-roll-b'])
    expect(sumPodRequestRates(pods)).toBe(100)
  })
})

describe('lbBackendTableRows', () => {
  it('builds mock-style backend rows from backendPods', () => {
    const rows = lbBackendTableRows(
      {
        backendPods: [
          {
            name: 'app-roll-a',
            ready: true,
            requestRate: 58,
            p99LatencyMs: 5.2,
            totalRequests: 100,
            cpuUsage: 0.41,
            errorRate: 0,
            memoryBytes: 180 * 1024 * 1024,
          },
          {
            name: 'app-roll-b',
            ready: true,
            requestRate: 42,
            p99LatencyMs: 4.9,
            totalRequests: 80,
            cpuUsage: 0.38,
            errorRate: 0,
            memoryBytes: 170 * 1024 * 1024,
          },
        ],
        perBackendRps: {},
      } as MetricsBucket,
      { cpuLimitCores: 1, memoryLimitBytes: 512 * 1024 * 1024 },
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.share).toBe('58%')
    expect(rows[1]?.share).toBe('42%')
    expect(rows[0]?.rps).toBe('58')
    expect(rows[0]?.p99).toBe('5.2 ms')
  })
})

describe('lbBackendSkewLabel', () => {
  it('formats share split for skew copy', () => {
    expect(
      lbBackendSkewLabel([
        {
          name: 'a',
          ready: true,
          requestRate: 58,
          p99LatencyMs: 0,
          totalRequests: 0,
          cpuUsage: 0,
          errorRate: 0,
          memoryBytes: 0,
        },
        {
          name: 'b',
          ready: true,
          requestRate: 42,
          p99LatencyMs: 0,
          totalRequests: 0,
          cpuUsage: 0,
          errorRate: 0,
          memoryBytes: 0,
        },
      ]),
    ).toBe('58 / 42')
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

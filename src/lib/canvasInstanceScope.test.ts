import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  canvasUnitPickEnabled,
  instanceIdForUnitIndex,
  sortedCanvasInstanceIds,
  unitPickEnabledForDisplay,
} from './canvasInstanceScope'
import { DB_LAYER_ID_POSTGRES_PRIMARY } from './dbInstanceScope'

function computeNode(): CanvasNode {
  return {
    id: 'app',
    type: 'compute',
    label: 'App',
    position: [0, 0, 0],
    status: 'healthy',
    config: { replicas: 3 },
  }
}

function workerNode(): CanvasNode {
  return {
    id: 'worker',
    type: 'worker',
    label: 'Worker',
    position: [0, 0, 0],
    status: 'healthy',
    config: { replicas: 3 },
  }
}

function dbNode(): CanvasNode {
  return {
    id: 'db',
    type: 'database',
    label: 'DB',
    position: [0, 0, 0],
    status: 'healthy',
    config: { readReplicas: 2 },
  }
}

function metrics(overrides: Partial<MetricsBucket> = {}): MetricsBucket {
  return {
    podReplicas: [],
    layers: [],
    ...overrides,
  } as MetricsBucket
}

describe('sortedCanvasInstanceIds', () => {
  it('sorts compute pod replicas by name and requires count match', () => {
    const ids = sortedCanvasInstanceIds(
      computeNode(),
      metrics({
        podReplicas: [
          { name: 'pod-b', cpuUsage: 0, memoryBytes: 0, requestRate: 1, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
          { name: 'pod-a', cpuUsage: 0, memoryBytes: 0, requestRate: 1, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
          { name: 'pod-c', cpuUsage: 0, memoryBytes: 0, requestRate: 1, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
        ],
      }),
      3,
    )
    expect(ids).toEqual(['pod-a', 'pod-b', 'pod-c'])
  })

  it('sorts worker pod replicas by name and requires count match', () => {
    const ids = sortedCanvasInstanceIds(
      workerNode(),
      metrics({
        podReplicas: [
          { name: 'worker-b', cpuUsage: 0, memoryBytes: 0, requestRate: 1, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
          { name: 'worker-a', cpuUsage: 0, memoryBytes: 0, requestRate: 1, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
          { name: 'worker-c', cpuUsage: 0, memoryBytes: 0, requestRate: 1, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
        ],
      }),
      3,
    )
    expect(ids).toEqual(['worker-a', 'worker-b', 'worker-c'])
  })

  it('returns empty when pod count does not match unit count', () => {
    expect(
      sortedCanvasInstanceIds(
        computeNode(),
        metrics({
          podReplicas: [
            { name: 'pod-a', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
          ],
        }),
        3,
      ),
    ).toEqual([])
  })

  it('orders database layers primary first then replicas by id', () => {
    const ids = sortedCanvasInstanceIds(
      dbNode(),
      metrics({
        layers: [
          { id: 'postgres-replica-b', role: 'replica', engine: 'postgresql', cpuUsage: 0, cpuLimit: 1, memoryBytes: 0, memoryLimit: 1, cpuIsEstimated: false, memIsEstimated: false },
          { id: DB_LAYER_ID_POSTGRES_PRIMARY, role: 'primary', engine: 'postgresql', cpuUsage: 0, cpuLimit: 1, memoryBytes: 0, memoryLimit: 1, cpuIsEstimated: false, memIsEstimated: false },
          { id: 'postgres-replica-a', role: 'replica', engine: 'postgresql', cpuUsage: 0, cpuLimit: 1, memoryBytes: 0, memoryLimit: 1, cpuIsEstimated: false, memIsEstimated: false },
        ],
      }),
      3,
    )
    expect(ids).toEqual([
      DB_LAYER_ID_POSTGRES_PRIMARY,
      'postgres-replica-a',
      'postgres-replica-b',
    ])
  })
})

describe('instanceIdForUnitIndex', () => {
  it('maps unit index to sorted instance id', () => {
    const node = computeNode()
    const bucket = metrics({
      podReplicas: [
        { name: 'pod-a', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
        { name: 'pod-b', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
      ],
    })
    expect(instanceIdForUnitIndex(node, bucket, 1, 2)).toBe('pod-b')
  })
})

describe('canvasUnitPickEnabled', () => {
  it('is true only when ids align with unit count', () => {
    const node = computeNode()
    const bucket = metrics({
      podReplicas: [
        { name: 'pod-a', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
        { name: 'pod-b', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
        { name: 'pod-c', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
      ],
    })
    expect(canvasUnitPickEnabled(node, bucket, 3)).toBe(true)
    expect(canvasUnitPickEnabled(node, bucket, 2)).toBe(false)
  })
})

describe('unitPickEnabledForDisplay', () => {
  it('requires expanded display before enabling unit pick', () => {
    const node = computeNode()
    const bucket = metrics({
      podReplicas: [
        { name: 'pod-a', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
        { name: 'pod-b', cpuUsage: 0, memoryBytes: 0, requestRate: 0, p99LatencyMs: 0, ready: true, totalRequests: 0, errorRate: 0 },
      ],
    })
    expect(unitPickEnabledForDisplay(false, node, bucket, 2)).toBe(false)
    expect(unitPickEnabledForDisplay(true, node, bucket, 2)).toBe(true)
  })
})

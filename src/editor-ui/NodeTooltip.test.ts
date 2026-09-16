import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { resolveGroupedDisplay } from './NodeTooltip'

function workerNode(): CanvasNode {
  return {
    id: 'worker',
    type: 'worker',
    label: 'Fan-out Worker',
    position: [0, 0, 0],
    status: 'healthy',
    config: { replicas: 3 },
  }
}

function computeNode(): CanvasNode {
  return {
    id: 'app',
    type: 'compute',
    label: 'App',
    position: [0, 0, 0],
    status: 'healthy',
    config: { replicas: 2 },
  }
}

function pod(name: string, requestRate: number, p99Ms: number) {
  return {
    name,
    ready: true,
    requestRate,
    p99LatencyMs: p99Ms,
    totalRequests: 10,
    cpuUsage: 0.1,
    errorRate: 0,
    memoryBytes: 32 * 1024 * 1024,
  }
}

function metrics(): MetricsBucket {
  return {
    cpuLimit: 1,
    memoryLimit: 256 * 1024 * 1024,
    podReplicas: [
      pod('worker-roll-a', 4, 40),
      pod('worker-roll-b', 6, 80),
    ],
  } as MetricsBucket
}

describe('resolveGroupedDisplay worker', () => {
  it('matches compute: cluster hover shows Cluster, not a generic node tooltip', () => {
    const clustered = resolveGroupedDisplay(workerNode(), metrics(), 'cluster')
    expect(clustered?.clusterScope).toBe(true)
    expect(clustered?.instanceLabel).toBeUndefined()
    expect(clustered?.rps).toBe(10)

    const compute = resolveGroupedDisplay(computeNode(), metrics(), null)
    expect(compute?.clusterScope).toBe(true)
  })

  it('uses component cpu/mem percent for multi-replica cluster tooltip', () => {
    const m = {
      ...metrics(),
      cpuPercent: 24,
      memPercent: 2,
      podReplicas: [
        pod('app-a', 5, 40),
        pod('app-b', 5, 80),
      ],
    } as MetricsBucket

    const display = resolveGroupedDisplay(computeNode(), m, null)
    expect(display?.cpuPct).toBe(24)
    expect(display?.memPct).toBe(2)
    expect(display?.rps).toBe(10)
  })

  it('matches compute: unit hover shows the pod instance label', () => {
    const display = resolveGroupedDisplay(
      workerNode(),
      metrics(),
      'worker-roll-b',
    )
    expect(display?.clusterScope).toBeUndefined()
    expect(display?.instanceLabel).toBe('roll-b')
    expect(display?.rps).toBe(6)
    expect(display?.p99Ms).toBe(80)
  })
})

function dbNode(): CanvasNode {
  return {
    id: 'db',
    type: 'database',
    label: 'PostgreSQL',
    position: [0, 0, 0],
    status: 'healthy',
    config: { readReplicas: 2 },
  }
}

function dbLayer(
  id: string,
  role: string,
  cpuUsage: number,
  memoryBytes: number,
  requestRate: number,
) {
  return {
    id,
    role,
    engine: 'postgresql',
    cpuUsage,
    cpuLimit: 0.25,
    memoryBytes,
    memoryLimit: 256 * 1024 * 1024,
    cpuIsEstimated: false,
    memIsEstimated: false,
    requestRate,
  }
}

describe('resolveGroupedDisplay database', () => {
  const bucket = {
    cpuPercent: 12,
    memPercent: 41,
    cpuIsEstimated: false,
    memIsEstimated: false,
    dbQueryRate: 6,
    requestRate: 6,
    layers: [
      dbLayer('postgres', 'primary', 0.03, 80 * 1024 * 1024, 4),
      dbLayer('postgres-replica-1', 'replica', 0.01, 70 * 1024 * 1024, 1),
      dbLayer('postgres-replica-2', 'replica', 0.01, 70 * 1024 * 1024, 1),
    ],
  } as MetricsBucket

  it('uses component cpu/mem for cluster hover, not a zeroed layer average', () => {
    const display = resolveGroupedDisplay(dbNode(), bucket, 'cluster')
    expect(display?.clusterScope).toBe(true)
    expect(display?.instanceLabel).toBeUndefined()
    expect(display?.cpuPct).toBe(12)
    expect(display?.memPct).toBe(41)
    expect(display?.rps).toBe(6)
  })

  it('maps replica unit hover to that replica, not primary', () => {
    const display = resolveGroupedDisplay(dbNode(), bucket, 'postgres-replica-1')
    expect(display?.clusterScope).toBeUndefined()
    expect(display?.instanceLabel).toBe('replica-1')
    expect(display?.rps).toBe(1)
    expect(display?.cpuPct).toBeGreaterThan(0)
    expect(display?.memPct).toBeGreaterThan(0)
  })
})

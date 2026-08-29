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
    const clustered = resolveGroupedDisplay(workerNode(), metrics(), false, 'cluster')
    expect(clustered?.clusterScope).toBe(true)
    expect(clustered?.instanceLabel).toBeUndefined()
    expect(clustered?.rps).toBe(10)

    const compute = resolveGroupedDisplay(computeNode(), metrics(), false, null)
    expect(compute?.clusterScope).toBe(true)
  })

  it('matches compute: unit hover shows the pod instance label', () => {
    const display = resolveGroupedDisplay(
      workerNode(),
      metrics(),
      false,
      'worker-roll-b',
    )
    expect(display?.clusterScope).toBeUndefined()
    expect(display?.instanceLabel).toBe('roll-b')
    expect(display?.rps).toBe(6)
    expect(display?.p99Ms).toBe(80)
  })
})

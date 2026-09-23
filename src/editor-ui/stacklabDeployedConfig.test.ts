import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { deployedConfigRows } from './stacklabDeployedConfig'

function node(
  partial: Partial<CanvasNode> & Pick<CanvasNode, 'id' | 'type' | 'label'>,
): CanvasNode {
  return {
    position: [0, 0, 0],
    status: 'healthy',
    config: {},
    ...partial,
  }
}

describe('deployedConfigRows', () => {
  it('renders compute wiring as kv rows', () => {
    const app = node({
      id: 'app',
      type: 'compute',
      label: 'App Server',
      config: { replicas: 2, maxConnections: 512 },
    })
    const cache = node({ id: 'cache', type: 'cache', label: 'Shortener Cache', config: {} })
    const db = node({ id: 'db', type: 'database', label: 'Shortener DB', config: {} })
    const edges: Record<string, CanvasEdge> = {
      e1: { id: 'e1', sourceId: 'app', targetId: 'cache', protocol: 'tcp', animated: false },
      e2: { id: 'e2', sourceId: 'app', targetId: 'db', protocol: 'tcp', animated: false },
    }
    const metrics = {
      podReplicas: [
        {
          name: 'app-roll-a',
          ready: true,
          requestRate: 1,
          p99LatencyMs: 1,
          totalRequests: 1,
          cpuUsage: 0.2,
          errorRate: 0,
          memoryBytes: 1,
        },
        {
          name: 'app-roll-b',
          ready: true,
          requestRate: 1,
          p99LatencyMs: 1,
          totalRequests: 1,
          cpuUsage: 0.2,
          errorRate: 0,
          memoryBytes: 1,
        },
      ],
      maxConnections: 512,
      cpuLimit: 1.5,
      memoryLimit: 1024 * 1024 * 1024,
    } as MetricsBucket

    const rows = deployedConfigRows(app, { app, cache, db }, edges, metrics)
    expect(rows.find((row) => row.key === 'replicas')?.value).toContain('roll-a')
    expect(rows.find((row) => row.key === 'upstream cache')?.value).toBe(
      'redis://shortener-cache:6379',
    )
    expect(rows.find((row) => row.key === 'store')?.value).toBe('postgres://shortener-db:5432')
    expect(rows.find((row) => row.key === 'max conns')?.value).toBe('512')
  })

  it('renders load balancer backends from topology', () => {
    const lb = node({
      id: 'lb',
      type: 'load_balancer',
      label: 'LB',
      config: { algorithm: 'round-robin' },
    })
    const appA = node({ id: 'a', type: 'compute', label: 'app-1', config: {} })
    const appB = node({ id: 'b', type: 'compute', label: 'app-2', config: {} })
    const edges: Record<string, CanvasEdge> = {
      e1: { id: 'e1', sourceId: 'lb', targetId: 'a', protocol: 'http', animated: false },
      e2: { id: 'e2', sourceId: 'lb', targetId: 'b', protocol: 'http', animated: false },
    }

    const rows = deployedConfigRows(
      lb,
      { lb, a: appA, b: appB },
      edges,
      { lbConnectionLimit: 1024 } as MetricsBucket,
    )
    expect(rows.find((row) => row.key === 'algorithm')?.value).toBe('round-robin')
    expect(rows.find((row) => row.key === 'backends')?.value).toBe('app-1, app-2')
    expect(rows.find((row) => row.key === 'max connections')?.value).toBe('1024')
  })
})

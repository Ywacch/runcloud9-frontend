import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../store/canvasStore'
import type { MetricsBucket } from '../store/metricsStore'
import type { SimNodeInspector } from './simulation/types'
import { buildFlowPaths } from './flowPaths'

function node(
  id: string,
  type: CanvasNode['type'],
  label: string
): CanvasNode {
  return {
    id,
    type,
    label,
    position: [0, 0, 0],
    config: {},
    status: 'healthy',
  }
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

describe('buildFlowPaths', () => {
  it('creates cache hit and miss paths', () => {
    const nodes: Record<string, CanvasNode> = {
      client: node('client', 'client', 'Client'),
      app: node('app', 'compute', 'App'),
      cache: node('cache', 'cache', 'Cache'),
      db: node('db', 'database', 'DB'),
    }
    const edges: Record<string, CanvasEdge> = {
      e1: { id: 'e1', sourceId: 'client', targetId: 'app', protocol: 'http', animated: true },
      e2: { id: 'e2', sourceId: 'app', targetId: 'cache', protocol: 'http', animated: true },
      e3: { id: 'e3', sourceId: 'cache', targetId: 'db', protocol: 'tcp', animated: true },
    }
    const metrics: Record<string, MetricsBucket> = {
      app: bucket({ p99Latency: 40, requestRate: 100 }),
      cache: bucket({ p99Latency: 10, requestRate: 100 }),
      db: bucket({ p99Latency: 70, requestRate: 20 }),
    }
    const inspector: Record<string, SimNodeInspector> = {
      cache: { cacheHitsQps: 80, cacheMissesQps: 20 },
    }

    const paths = buildFlowPaths(nodes, edges, metrics, inspector)
    const names = paths.map((p) => p.name)
    expect(paths.length).toBe(2)
    expect(names).toContain('Read path (cache hit)')
    expect(names).toContain('Read path (cache miss)')
    expect(paths.some((p) => p.hops.some((h) => h.nodeId === 'db'))).toBe(true)
  })

  it('creates async continuation path for mq handoff', () => {
    const nodes: Record<string, CanvasNode> = {
      app: node('app', 'compute', 'App'),
      mq: node('mq', 'message_queue', 'Queue'),
      worker: node('worker', 'worker', 'Worker'),
    }
    const edges: Record<string, CanvasEdge> = {
      e1: { id: 'e1', sourceId: 'app', targetId: 'mq', protocol: 'http', animated: true },
      e2: { id: 'e2', sourceId: 'worker', targetId: 'mq', protocol: 'tcp', animated: true },
    }
    const metrics: Record<string, MetricsBucket> = {
      app: bucket({ p99Latency: 20, requestRate: 100 }),
      mq: bucket({ p99Latency: 5, requestRate: 100 }),
      worker: bucket({ p99Latency: 80, requestRate: 100 }),
    }

    const paths = buildFlowPaths(nodes, edges, metrics, {})
    expect(paths.some((p) => p.asyncContinuation)).toBe(true)
  })
})

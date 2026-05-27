import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../../stores/canvasStore'
import { SimulationEngine } from './SimulationEngine'
import { WORKLOAD_BY_TEMPLATE_ID } from './workloadProfiles'

function stepMany(
  engine: SimulationEngine,
  n: number
): ReturnType<SimulationEngine['step']> {
  let last = engine.step(16)
  for (let i = 1; i < n; i++) last = engine.step(16)
  return last
}

describe('SimulationEngine', () => {
  it('propagates RPS from client through LB to compute', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 1000 },
        status: 'idle',
      },
      {
        id: 'lb1',
        type: 'load_balancer',
        position: [2, 0.3, 0],
        label: 'LB',
        config: { algorithm: 'round-robin' },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [4, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceId: 'c1',
        targetId: 'lb1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e2',
        sourceId: 'lb1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 50)
    expect(r.metrics.app1?.throughputQps ?? 0).toBeGreaterThan(100)
    expect(r.inspector.lb1?.backendSplit?.length).toBe(1)
    expect(r.inspector.app1?.ingressQps ?? 0).toBeGreaterThan(50)
  })

  it('reduces DB load vs compute when cache absorbs with url-shortener workload', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 1000 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 2, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'ca1',
        type: 'cache',
        position: [4, 0.3, 0],
        label: 'Cache',
        config: { cacheStrategy: 'cache-aside' },
        status: 'idle',
      },
      {
        id: 'db1',
        type: 'database',
        position: [6, 0.3, 0],
        label: 'DB',
        config: { maxConnections: 500, storageGB: 20 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceId: 'c1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e2',
        sourceId: 'app1',
        targetId: 'ca1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e3',
        sourceId: 'ca1',
        targetId: 'db1',
        protocol: 'tcp',
        animated: true,
      },
    ]
    const profile = WORKLOAD_BY_TEMPLATE_ID['url-shortener']
    const engine = new SimulationEngine(nodes, edges, profile)
    const r = stepMany(engine, 50)
    const appQ = r.metrics.app1?.throughputQps ?? 0
    const dbQ = r.metrics.db1?.throughputQps ?? 0
    expect(appQ).toBeGreaterThan(50)
    expect(dbQ).toBeLessThan(appQ * 0.85)
    expect(r.inspector.ca1?.cacheHitsQps ?? 0).toBeGreaterThan(0)
    expect(r.inspector.ca1?.cacheMissesQps ?? 0).toBeGreaterThan(0)
    const dbBreak = r.inspector.db1?.databaseBreakdown ?? []
    expect(dbBreak.some((x) => x.label.includes('SELECT'))).toBe(true)
  })

  it('ecommerce workload produces multi-label DB breakdown', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 800 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 2, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'db1',
        type: 'database',
        position: [4, 0.3, 0],
        label: 'DB',
        config: { maxConnections: 200, storageGB: 50 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceId: 'c1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e2',
        sourceId: 'app1',
        targetId: 'db1',
        protocol: 'tcp',
        animated: true,
      },
    ]
    const profile = WORKLOAD_BY_TEMPLATE_ID.ecommerce
    const engine = new SimulationEngine(nodes, edges, profile)
    const r = stepMany(engine, 50)
    const rows = r.inspector.db1?.databaseBreakdown ?? []
    expect(rows.length).toBeGreaterThanOrEqual(2)
    const sum = rows.reduce((s, x) => s + x.qps, 0)
    expect(sum).toBeGreaterThan(0)
  })

  it('raises compute error rate when overloaded vs capacity', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 5000 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'small' },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceId: 'c1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    engine.setLoadFactor(1)
    const r = stepMany(engine, 50)
    expect(r.metrics.app1?.errorRate ?? 0).toBeGreaterThan(0.25)
  })

  it('builds MQ queue depth when producer exceeds worker throughput', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 5000 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 2, instanceSize: 'xlarge' },
        status: 'idle',
      },
      {
        id: 'mq1',
        type: 'message_queue',
        position: [4, 0.3, 0],
        label: 'MQ',
        config: {},
        status: 'idle',
      },
      {
        id: 'w1',
        type: 'worker',
        position: [6, 0.3, 0],
        label: 'Worker',
        config: {
          replicas: 1,
          instanceSize: 'small',
          processingTimeMs: 200,
          jobType: 'cpu-bound',
        },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceId: 'c1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e2',
        sourceId: 'app1',
        targetId: 'mq1',
        protocol: 'tcp',
        animated: true,
      },
      {
        id: 'e3',
        sourceId: 'w1',
        targetId: 'mq1',
        protocol: 'tcp',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const last = stepMany(engine, 50)
    const q = last.mqQueueDepth.mq1 ?? 0
    expect(q).toBeGreaterThan(0)
  })
})

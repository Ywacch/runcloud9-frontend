import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../../store/canvasStore'
import type { SimulationWorkerOutMessage } from './simulation.worker'
import { SimulationEngine } from './SimulationEngine'
import type { SimulationTickResult } from './types'
import { WORKLOAD_BY_TEMPLATE_ID } from './workloadProfiles'

function minimalClientLbApp(): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = [
    {
      id: 'c1',
      type: 'client',
      position: [0, 0.3, 0],
      label: 'Client',
      config: { requestsPerSecond: 500 },
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
  return { nodes, edges }
}

describe('SimulationTickResult worker contract', () => {
  it('step() returns all fields required for SimulationWorkerOutMessage', () => {
    const { nodes, edges } = minimalClientLbApp()
    const engine = new SimulationEngine(nodes, edges)
    const r = engine.step(1000 / 60)

    expect(typeof r.tick).toBe('number')
    expect(r.tick).toBeGreaterThanOrEqual(1)
    expect(r.metrics).toBeDefined()
    expect(typeof r.metrics).toBe('object')
    expect(typeof r.cacheHitsDelta).toBe('number')
    expect(typeof r.cacheMissesDelta).toBe('number')
    expect(r.mqQueueDepth).toBeDefined()
    expect(typeof r.mqQueueDepth).toBe('object')
    expect(r.inspector).toBeDefined()
    expect(typeof r.inspector).toBe('object')
    expect(Array.isArray(r.diagnostics)).toBe(true)
    expect(r.edgeFlows).toBeDefined()
    expect(typeof r.edgeFlows).toBe('object')

    const msg: SimulationWorkerOutMessage = { type: 'tick', ...r }
    expect(msg.type).toBe('tick')
    expect(msg.tick).toBe(r.tick)
  })

  it('round-trip: spread into tick message matches SimulationTickResult shape', () => {
    const { nodes, edges } = minimalClientLbApp()
    const engine = new SimulationEngine(nodes, edges)
    let last: SimulationTickResult = engine.step(16)
    for (let i = 1; i < 5; i++) last = engine.step(16)

    const msg: SimulationWorkerOutMessage = { type: 'tick', ...last }
    const { type: _t, ...rest } = msg
    const again: SimulationTickResult = rest
    expect(again.tick).toBe(last.tick)
    expect(Object.keys(again.metrics).length).toBeGreaterThan(0)
  })

  it('inspector entries for cache and compute include expected keys under url-shortener workload', () => {
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
        config: { replicas: 1, instanceSize: 'large' },
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
    let r = engine.step(16)
    for (let i = 1; i < 8; i++) r = engine.step(16)

    const appInsp = r.inspector.app1
    expect(appInsp).toBeDefined()
    expect(
      appInsp!.ingressQps != null ||
        appInsp!.servedQps != null ||
        (appInsp!.backendSplit?.length ?? 0) > 0
    ).toBe(true)

    const cacheInsp = r.inspector.ca1
    expect(cacheInsp).toBeDefined()
    expect(
      (cacheInsp!.cacheHitsQps ?? 0) > 0 ||
        (cacheInsp!.cacheMissesQps ?? 0) > 0 ||
        (cacheInsp!.cacheKeySamples?.length ?? 0) > 0
    ).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  applySingletonCollapse,
  findMultiSingletonGroup,
  planSingletonCollapse,
} from './collapseSingleton'
import { assessGraphConstraints } from './graphConstraints'

function node(
  id: string,
  type: CanvasNode['type'],
  replicas = 1,
  label?: string,
): CanvasNode {
  return {
    id,
    type,
    label: label ?? id,
    position: [0, 0, 0],
    config: { replicas },
    status: 'idle',
  }
}

function edge(id: string, sourceId: string, targetId: string): CanvasEdge {
  return {
    id,
    sourceId,
    targetId,
    protocol: 'tcp',
    animated: false,
  }
}

describe('collapseSingleton', () => {
  it('detects multi app-server before worker', () => {
    const nodes = {
      a: node('a', 'compute'),
      b: node('b', 'compute'),
      w1: node('w1', 'worker'),
      w2: node('w2', 'worker'),
      db: node('db', 'database'),
    }
    const group = findMultiSingletonGroup(nodes)
    expect(group?.kind).toBe('app-server')
    expect(group?.nodes).toHaveLength(2)
  })

  it('sums replicas and caps at maxAllowed', () => {
    const nodes = {
      a: node('a', 'compute', 2),
      b: node('b', 'compute', 2),
      db: node('db', 'database'),
    }
    const edges = {
      e1: edge('e1', 'a', 'db'),
      e2: edge('e2', 'b', 'db'),
    }
    const plan = planSingletonCollapse(nodes, edges, 3)
    expect(plan).not.toBeNull()
    expect(plan!.summedReplicas).toBe(4)
    expect(plan!.cappedReplicas).toBe(3)
    expect(plan!.wasCapped).toBe(true)
  })

  it('keeps the higher-degree node and rewires edges', () => {
    const nodes = {
      a: node('a', 'compute', 1),
      b: node('b', 'compute', 1),
      db: node('db', 'database'),
      cache: node('cache', 'cache'),
    }
    const edges = {
      e1: edge('e1', 'a', 'db'),
      e2: edge('e2', 'a', 'cache'),
      e3: edge('e3', 'b', 'db'),
    }
    const plan = planSingletonCollapse(nodes, edges, 3)!
    expect(plan.keepId).toBe('a')
    expect(plan.removeIds).toEqual(['b'])

    const next = applySingletonCollapse(nodes, edges, plan)
    expect(Object.keys(next.nodes).sort()).toEqual(['a', 'cache', 'db'])
    expect(next.nodes.a.config.replicas).toBe(2)
    const pairs = Object.values(next.edges).map(
      (e) => `${e.sourceId}->${e.targetId}`,
    )
    expect(pairs.sort()).toEqual(['a->cache', 'a->db'])
    expect(assessGraphConstraints(next.nodes, next.edges)).toBeNull()
  })

  it('collapses multiple workers onto one with capped replicas', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      mq: node('mq', 'message_queue'),
      w1: node('w1', 'worker', 2, 'W1'),
      w2: node('w2', 'worker', 2, 'W2'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'app', 'mq'),
      e3: edge('e3', 'w1', 'mq'),
      e4: edge('e4', 'w1', 'db'),
      e5: edge('e5', 'w2', 'mq'),
      e6: edge('e6', 'w2', 'db'),
    }
    expect(assessGraphConstraints(nodes, edges)).toMatch(/only one worker/i)
    const plan = planSingletonCollapse(nodes, edges, 3)!
    expect(plan.kind).toBe('worker')
    expect(plan.cappedReplicas).toBe(3)
    const next = applySingletonCollapse(nodes, edges, plan)
    expect(Object.values(next.nodes).filter((n) => n.type === 'worker')).toHaveLength(
      1,
    )
    expect(assessGraphConstraints(next.nodes, next.edges)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { isoToNode } from '../../canvas/utils/positionAdapter'
import {
  archetypeToCanvasType,
  canvasNodeToSvgNode,
  canvasPositionToSvgWorld,
  canvasTypeToArchetype,
  configPatchForEngine,
  configPatchForReplicas,
  engineFromCanvasNode,
  replicasFromCanvasNode,
  shardsFromCanvasNode,
  svgWorldToCanvasPosition,
} from './canvasSvgAdapter'

function node(
  partial: Partial<CanvasNode> & Pick<CanvasNode, 'type'>,
): CanvasNode {
  return {
    id: partial.id ?? 'n1',
    type: partial.type,
    position: partial.position ?? isoToNode(2, -1),
    label: partial.label ?? 'Node',
    config: partial.config ?? {},
    status: partial.status ?? 'idle',
  }
}

describe('canvasSvgAdapter type map', () => {
  it('round-trips archetypes except client stays client', () => {
    const types = [
      'compute',
      'database',
      'cache',
      'load_balancer',
      'message_queue',
      'worker',
      'client',
    ] as const
    for (const t of types) {
      expect(archetypeToCanvasType(canvasTypeToArchetype(t))).toBe(t)
    }
  })
})

describe('canvasSvgAdapter positions', () => {
  it('round-trips integer lattice positions through SVG world', () => {
    const pos = isoToNode(3, -2)
    const world = canvasPositionToSvgWorld(pos)
    const back = svgWorldToCanvasPosition(world.x, world.y)
    expect(back[0]).toBe(pos[0])
    expect(back[2]).toBe(pos[2])
  })
})

describe('canvasSvgAdapter config projection', () => {
  it('reads cache engine from cacheEngine', () => {
    expect(
      engineFromCanvasNode(
        node({ type: 'cache', config: { cacheEngine: 'memcached' } }),
      ),
    ).toBe('memcached')
  })

  it('maps database readReplicas to visual replica count and patches readReplicas', () => {
    expect(
      replicasFromCanvasNode(
        node({ type: 'database', config: { readReplicas: 2 } }),
      ),
    ).toBe(3)
    expect(configPatchForReplicas('database', 3)).toEqual({ readReplicas: 2 })
    expect(configPatchForReplicas('cache', 2)).toEqual({})
  })

  it('maps compute and worker replicas both ways', () => {
    expect(
      replicasFromCanvasNode(node({ type: 'compute', config: { replicas: 3 } })),
    ).toBe(3)
    expect(configPatchForReplicas('compute', 2)).toEqual({ replicas: 2 })
    expect(
      replicasFromCanvasNode(node({ type: 'worker', config: { replicas: 2 } })),
    ).toBe(2)
    expect(configPatchForReplicas('worker', 2)).toEqual({ replicas: 2 })
  })

  it('reads shards from config for db/mq', () => {
    expect(
      shardsFromCanvasNode(node({ type: 'database', config: { shards: 3 } })),
    ).toBe(3)
    expect(
      shardsFromCanvasNode(node({ type: 'compute', config: { shards: 9 } })),
    ).toBe(1)
  })

  it('writes engine patches per type', () => {
    expect(configPatchForEngine('cache', 'redis')).toEqual({
      cacheEngine: 'redis',
      engine: 'redis',
    })
    expect(configPatchForEngine('database', 'postgresql')).toEqual({
      engine: 'postgresql',
    })
  })

  it('projects a canvas node into an SvgNode', () => {
    const svg = canvasNodeToSvgNode(
      node({
        type: 'cache',
        config: { cacheEngine: 'redis', replicas: 2 },
        position: isoToNode(1, 0),
      }),
    )
    expect(svg.archetype).toBe('cache')
    expect(svg.engine).toBe('redis')
    expect(svg.topology.replicas).toBe(2)
    expect(svg.x).toBe(canvasPositionToSvgWorld(isoToNode(1, 0)).x)
  })

  it('projects the traffic-source client into archetype client', () => {
    const svg = canvasNodeToSvgNode(
      node({
        id: 'client-loadgen',
        type: 'client',
        label: 'Traffic Source',
        position: isoToNode(0, 0),
      }),
    )
    expect(svg.archetype).toBe('client')
    expect(svg.engine).toBe('generic')
    expect(svg.topology.replicas).toBe(1)
  })
})

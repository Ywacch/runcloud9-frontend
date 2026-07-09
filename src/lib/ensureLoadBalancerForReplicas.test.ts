import { beforeEach, describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  AUTO_LOAD_BALANCER_ID,
  ensureLoadBalancerForReplicas,
} from './ensureLoadBalancerForReplicas'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'

function computeNode(
  id: string,
  replicas: number,
  position: [number, number, number] = [6, 0.3, 0],
): CanvasNode {
  return {
    id,
    type: 'compute',
    label: 'App Server',
    position,
    config: { replicas, instanceSize: 'small' },
    status: 'idle',
  }
}

function lbNode(id = 'lb-manual'): CanvasNode {
  return {
    id,
    type: 'load_balancer',
    label: 'Load Balancer',
    position: [3, 0.3, 0],
    config: { algorithm: 'round-robin' },
    status: 'idle',
  }
}

describe('ensureLoadBalancerForReplicas', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: {},
      edges: {},
      selectedId: null,
      selectedIds: [],
    })
  })

  it('adds auto LB and edge when replicas > 1 and no LB exists', () => {
    useCanvasStore.setState({
      nodes: { 'app-1': computeNode('app-1', 2, [6, 0.3, 0]) },
      edges: {},
    })

    ensureLoadBalancerForReplicas()

    const { nodes, edges } = useCanvasStore.getState()
    expect(nodes[AUTO_LOAD_BALANCER_ID]?.type).toBe('load_balancer')
    expect(nodes[AUTO_LOAD_BALANCER_ID]?.config.autoAdded).toBe(true)
    expect(
      Object.values(edges).some(
        (e) =>
          e.sourceId === AUTO_LOAD_BALANCER_ID && e.targetId === 'app-1',
      ),
    ).toBe(true)
    // Dependency-layer arrange places LB upstream of compute (lower x).
    expect(nodes[AUTO_LOAD_BALANCER_ID]!.position[0]).toBeLessThan(
      nodes['app-1']!.position[0],
    )
  })

  it('is unchanged when an LB already exists', () => {
    useCanvasStore.setState({
      nodes: {
        'app-1': computeNode('app-1', 2),
        'lb-manual': lbNode(),
      },
      edges: {},
    })

    ensureLoadBalancerForReplicas()

    const { nodes } = useCanvasStore.getState()
    expect(nodes[AUTO_LOAD_BALANCER_ID]).toBeUndefined()
    expect(nodes['lb-manual']).toBeDefined()
  })

  it('keeps auto LB when replicas scale back to 1', () => {
    useCanvasStore.setState({
      nodes: { 'app-1': computeNode('app-1', 2) },
      edges: {},
    })
    ensureLoadBalancerForReplicas()

    useCanvasStore.getState().updateNodeConfig('app-1', { replicas: 1 })
    ensureLoadBalancerForReplicas()

    expect(useCanvasStore.getState().nodes[AUTO_LOAD_BALANCER_ID]).toBeDefined()
  })

  it('rewires client-loadgen to the auto LB when present', () => {
    useCanvasStore.setState({
      nodes: {
        'app-1': computeNode('app-1', 2),
        [CLIENT_LOADGEN_ID]: {
          id: CLIENT_LOADGEN_ID,
          type: 'client',
          label: 'Traffic Source',
          position: [3, 0.3, 0],
          config: {},
          status: 'healthy',
        },
      },
      edges: {
        'edge-client-app-1': {
          id: 'edge-client-app-1',
          sourceId: CLIENT_LOADGEN_ID,
          targetId: 'app-1',
          protocol: 'http',
          animated: true,
        },
      },
    })

    ensureLoadBalancerForReplicas()

    const { edges } = useCanvasStore.getState()
    expect(edges[`edge-client-${AUTO_LOAD_BALANCER_ID}`]).toMatchObject({
      sourceId: CLIENT_LOADGEN_ID,
      targetId: AUTO_LOAD_BALANCER_ID,
    })
    expect(edges['edge-client-app-1']).toBeUndefined()
  })
})

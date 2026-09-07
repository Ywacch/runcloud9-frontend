import { beforeEach, describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  AUTO_LOAD_BALANCER_ID,
  ensureLoadBalancerForReplicas,
  ensureLoadBalancerForReplicasInSnapshot,
} from './ensureLoadBalancerForReplicas'
import { snapshotToDeploymentDesign } from './deployPayload'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'
import { canvasPositionToSvgWorld } from '../svg-canvas/bridge/canvasSvgAdapter'

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
    // Dependency-layer arrange advances NE, so the upstream LB sits SW of
    // compute on the SVG projector (lower screen x).
    const lbWorld = canvasPositionToSvgWorld(
      nodes[AUTO_LOAD_BALANCER_ID]!.position,
    )
    const appWorld = canvasPositionToSvgWorld(nodes['app-1']!.position)
    expect(lbWorld.x).toBeLessThan(appWorld.x)
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

  it('removes auto LB when replicas scale back to 1', () => {
    useCanvasStore.setState({
      nodes: { 'app-1': computeNode('app-1', 2) },
      edges: {},
    })
    ensureLoadBalancerForReplicas()
    expect(useCanvasStore.getState().nodes[AUTO_LOAD_BALANCER_ID]).toBeDefined()

    useCanvasStore.getState().updateNodeConfig('app-1', { replicas: 1 })
    ensureLoadBalancerForReplicas()

    expect(useCanvasStore.getState().nodes[AUTO_LOAD_BALANCER_ID]).toBeUndefined()
  })

  it('rearranges remaining nodes after auto LB is removed', () => {
    useCanvasStore.setState({
      nodes: {
        app: computeNode('app', 2, [0, 0.3, 0]),
        queue: {
          id: 'queue',
          type: 'message_queue',
          label: 'Queue',
          position: [4, 0.3, 0],
          config: {},
          status: 'idle',
        },
        worker: {
          id: 'worker',
          type: 'worker',
          label: 'Worker',
          position: [8, 0.3, 0],
          config: { replicas: 1 },
          status: 'idle',
        },
        cache: {
          id: 'cache',
          type: 'cache',
          label: 'Cache',
          position: [12, 0.3, 0],
          config: {},
          status: 'idle',
        },
      },
      edges: {
        'app-queue': {
          id: 'app-queue',
          sourceId: 'app',
          targetId: 'queue',
          protocol: 'http',
          animated: false,
        },
        'queue-worker': {
          id: 'queue-worker',
          sourceId: 'queue',
          targetId: 'worker',
          protocol: 'tcp',
          animated: false,
        },
        'worker-cache': {
          id: 'worker-cache',
          sourceId: 'worker',
          targetId: 'cache',
          protocol: 'tcp',
          animated: false,
        },
      },
    })

    ensureLoadBalancerForReplicas()
    const withLb = useCanvasStore.getState().nodes
    expect(withLb[AUTO_LOAD_BALANCER_ID]).toBeDefined()
    const appToQueueWithLb = Math.abs(
      withLb.queue.position[2] - withLb.app.position[2],
    )

    useCanvasStore.getState().updateNodeConfig('app', { replicas: 1 })
    ensureLoadBalancerForReplicas()

    const withoutLb = useCanvasStore.getState().nodes
    expect(withoutLb[AUTO_LOAD_BALANCER_ID]).toBeUndefined()
    const appToQueueWithoutLb = Math.abs(
      withoutLb.queue.position[2] - withoutLb.app.position[2],
    )
    expect(appToQueueWithoutLb).not.toBe(appToQueueWithLb)
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

describe('ensureLoadBalancerForReplicasInSnapshot', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: {},
      edges: {},
      selectedId: null,
      selectedIds: [],
      snapshotTemplateId: 'url-shortener',
    })
  })

  it('injects LB in the returned snapshot without mutating the canvas store', () => {
    useCanvasStore.setState({
      nodes: { 'app-1': computeNode('app-1', 2, [6, 0.3, 0]) },
      edges: {},
    })
    ensureLoadBalancerForReplicas()
    useCanvasStore.getState().removeNode(AUTO_LOAD_BALANCER_ID)

    const snapshot = useCanvasStore.getState().exportJSON()
    expect(snapshot.nodes.some((node) => node.id === AUTO_LOAD_BALANCER_ID)).toBe(
      false,
    )

    const withLb = ensureLoadBalancerForReplicasInSnapshot(snapshot)
    expect(withLb.nodes.some((node) => node.id === AUTO_LOAD_BALANCER_ID)).toBe(
      true,
    )
    expect(
      useCanvasStore.getState().nodes[AUTO_LOAD_BALANCER_ID],
    ).toBeUndefined()
  })

  it('snapshotToDeploymentDesign with mutateCanvas false leaves the store unchanged', () => {
    useCanvasStore.setState({
      nodes: { 'app-1': computeNode('app-1', 2, [6, 0.3, 0]) },
      edges: {},
    })
    ensureLoadBalancerForReplicas()
    useCanvasStore.getState().removeNode(AUTO_LOAD_BALANCER_ID)

    const snapshot = useCanvasStore.getState().exportJSON()
    snapshotToDeploymentDesign(snapshot, { mutateCanvas: false })

    expect(useCanvasStore.getState().nodes[AUTO_LOAD_BALANCER_ID]).toBeUndefined()
    const design = snapshotToDeploymentDesign(snapshot, { mutateCanvas: false })
    expect(design.nodes.some((node) => node.type === 'lb')).toBe(true)
  })
})

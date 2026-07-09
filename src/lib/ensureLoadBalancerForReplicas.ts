import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'
import { autoArrangeByDependencyLayers } from './autoArrange'
import { withoutCanvasHistoryRecording } from './canvasHistory'
import { defaultEdgeProtocol } from './defaultEdgeProtocol'
import { createCanvasNode } from './nodeFactory'
import { clampAppServerReplicas } from './replicaConfig'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'

export const AUTO_LOAD_BALANCER_ID = 'auto-load-balancer'

function scaledComputeNodes(nodes: Record<string, CanvasNode>): CanvasNode[] {
  return Object.values(nodes).filter(
    (n) =>
      n.type === 'compute' &&
      clampAppServerReplicas(n.config.replicas ?? 1) > 1,
  )
}

function hasLoadBalancer(nodes: Record<string, CanvasNode>): boolean {
  return Object.values(nodes).some((n) => n.type === 'load_balancer')
}

function hasEdge(
  edges: Record<string, { sourceId: string; targetId: string }>,
  sourceId: string,
  targetId: string,
): boolean {
  return Object.values(edges).some(
    (e) => e.sourceId === sourceId && e.targetId === targetId,
  )
}

/** Inject LB + edges when any compute scales past 1 replica and no LB exists. */
export function ensureLoadBalancerForReplicas(): void {
  const st = useCanvasStore.getState()
  const { nodes, edges } = st
  if (hasLoadBalancer(nodes)) return

  const scaled = scaledComputeNodes(nodes)
  if (scaled.length === 0) return

  const anchor = scaled.reduce((leftmost, n) =>
    n.position[0] < leftmost.position[0] ? n : leftmost,
  )
  const position: [number, number, number] = [
    anchor.position[0] - 3,
    anchor.position[1],
    anchor.position[2],
  ]

  const lbNode = createCanvasNode('load_balancer', position, nodes)
  lbNode.id = AUTO_LOAD_BALANCER_ID
  lbNode.label = 'Load Balancer'
  lbNode.config = {
    ...lbNode.config,
    algorithm: 'round-robin',
    autoAdded: true,
  }
  st.addNode(lbNode)

  for (const compute of scaled) {
    if (hasEdge(edges, AUTO_LOAD_BALANCER_ID, compute.id)) continue
    st.addEdge({
      id: `edge-${AUTO_LOAD_BALANCER_ID}-${compute.id}`,
      sourceId: AUTO_LOAD_BALANCER_ID,
      targetId: compute.id,
      protocol: defaultEdgeProtocol('load_balancer', 'compute'),
      animated: false,
    })
  }

  if (nodes[CLIENT_LOADGEN_ID]) {
    const clientEdge = Object.values(st.edges).find(
      (e) => e.sourceId === CLIENT_LOADGEN_ID,
    )
    if (clientEdge && clientEdge.targetId !== AUTO_LOAD_BALANCER_ID) {
      st.removeEdge(clientEdge.id)
      st.addEdge({
        id: `edge-client-${AUTO_LOAD_BALANCER_ID}`,
        sourceId: CLIENT_LOADGEN_ID,
        targetId: AUTO_LOAD_BALANCER_ID,
        protocol: defaultEdgeProtocol('client', 'load_balancer'),
        animated: true,
      })
    }
  }

  autoArrangeCanvasAfterLbInject()
}

function autoArrangeCanvasAfterLbInject(): void {
  const st = useCanvasStore.getState()
  const nodeList = Object.values(st.nodes)
  if (nodeList.length === 0) return
  const nextPositions = autoArrangeByDependencyLayers(
    nodeList,
    Object.values(st.edges),
  )
  withoutCanvasHistoryRecording(() => {
    for (const [id, pos] of Object.entries(nextPositions)) {
      st.updateNodePosition(id, pos)
    }
  })
  requestCanvasFit()
}

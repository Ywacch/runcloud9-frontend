import type {
  CanvasEdge,
  CanvasNode,
  CanvasSnapshot,
} from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { applyAutoArrange } from './applyAutoArrange'
import { defaultEdgeProtocol } from './defaultEdgeProtocol'
import { createCanvasNode } from './nodeFactory'
import { clampAppServerReplicas } from './replicaConfig'
import { autoscaleFromConfig } from './autoscaleConfig'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'

export const AUTO_LOAD_BALANCER_ID = 'auto-load-balancer'

function scaledComputeNodes(nodes: Record<string, CanvasNode>): CanvasNode[] {
  return Object.values(nodes).filter((n) => computeNeedsLoadBalancer(n))
}

function computeNeedsLoadBalancer(node: CanvasNode): boolean {
  if (node.type !== 'compute') return false
  const ac = autoscaleFromConfig(node.config.autoscale)
  if (ac && ac.max > 1) return true
  return clampAppServerReplicas(node.config.replicas ?? 1) > 1
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

function nodesRecord(nodes: CanvasNode[]): Record<string, CanvasNode> {
  return Object.fromEntries(nodes.map((node) => [node.id, node]))
}

function edgesRecord(edges: CanvasEdge[]): Record<string, CanvasEdge> {
  return Object.fromEntries(edges.map((edge) => [edge.id, edge]))
}

/** Pure LB inject for quota preview and budget math — does not touch the canvas store. */
export function ensureLoadBalancerForReplicasInSnapshot(
  snapshot: CanvasSnapshot,
): CanvasSnapshot {
  const nodeMap = { ...nodesRecord(snapshot.nodes) }
  let nextEdges = [...snapshot.edges]
  const edgeMap = edgesRecord(nextEdges)

  if (hasLoadBalancer(nodeMap)) return snapshot

  const scaled = scaledComputeNodes(nodeMap)
  if (scaled.length === 0) return snapshot

  const anchor = scaled.reduce((leftmost, node) =>
    node.position[0] < leftmost.position[0] ? node : leftmost,
  )
  const position: [number, number, number] = [
    anchor.position[0] - 3,
    anchor.position[1],
    anchor.position[2],
  ]

  const lbNode = createCanvasNode('load_balancer', position, nodeMap)
  lbNode.id = AUTO_LOAD_BALANCER_ID
  lbNode.label = 'Load Balancer'
  lbNode.config = {
    ...lbNode.config,
    algorithm: 'round-robin',
    autoAdded: true,
  }
  nodeMap[AUTO_LOAD_BALANCER_ID] = lbNode

  for (const compute of scaled) {
    if (hasEdge(edgeMap, AUTO_LOAD_BALANCER_ID, compute.id)) continue
    const edge: CanvasEdge = {
      id: `edge-${AUTO_LOAD_BALANCER_ID}-${compute.id}`,
      sourceId: AUTO_LOAD_BALANCER_ID,
      targetId: compute.id,
      protocol: defaultEdgeProtocol('load_balancer', 'compute'),
      animated: false,
    }
    nextEdges.push(edge)
    edgeMap[edge.id] = edge
  }

  if (nodeMap[CLIENT_LOADGEN_ID]) {
    const clientEdgeIndex = nextEdges.findIndex(
      (edge) => edge.sourceId === CLIENT_LOADGEN_ID,
    )
    if (
      clientEdgeIndex >= 0 &&
      nextEdges[clientEdgeIndex]!.targetId !== AUTO_LOAD_BALANCER_ID
    ) {
      nextEdges = nextEdges.filter((_, index) => index !== clientEdgeIndex)
      nextEdges.push({
        id: `edge-client-${AUTO_LOAD_BALANCER_ID}`,
        sourceId: CLIENT_LOADGEN_ID,
        targetId: AUTO_LOAD_BALANCER_ID,
        protocol: defaultEdgeProtocol('client', 'load_balancer'),
        animated: true,
      })
    }
  }

  return {
    ...snapshot,
    nodes: Object.values(nodeMap),
    edges: nextEdges,
  }
}

/** Add or remove the auto LB as compute replica count changes. */
export function syncAutoLoadBalancerForReplicas(): void {
  const st = useCanvasStore.getState()
  const scaled = scaledComputeNodes(st.nodes)
  if (scaled.length > 0) {
    if (!hasLoadBalancer(st.nodes)) {
      injectAutoLoadBalancer(scaled)
    }
    return
  }
  removeAutoLoadBalancerIfPresent()
}

/** Inject LB + edges when any compute scales past 1 replica and no LB exists. */
export function ensureLoadBalancerForReplicas(): void {
  syncAutoLoadBalancerForReplicas()
}

function injectAutoLoadBalancer(scaled: CanvasNode[]): void {
  const st = useCanvasStore.getState()
  const { nodes, edges } = st
  if (hasLoadBalancer(nodes)) return
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

  autoArrangeAfterLbSync()
}

function removeAutoLoadBalancerIfPresent(): void {
  const st = useCanvasStore.getState()
  const lb = st.nodes[AUTO_LOAD_BALANCER_ID]
  if (!lb || lb.config.autoAdded !== true) return

  const computeTargetId = Object.values(st.edges).find(
    (edge) => edge.sourceId === AUTO_LOAD_BALANCER_ID,
  )?.targetId

  st.removeNode(AUTO_LOAD_BALANCER_ID)

  const live = useCanvasStore.getState()
  if (
    computeTargetId &&
    live.nodes[CLIENT_LOADGEN_ID] &&
    !Object.values(live.edges).some((edge) => edge.sourceId === CLIENT_LOADGEN_ID)
  ) {
    live.addEdge({
      id: `edge-client-${computeTargetId}`,
      sourceId: CLIENT_LOADGEN_ID,
      targetId: computeTargetId,
      protocol: defaultEdgeProtocol('client', 'compute'),
      animated: true,
    })
  }

  autoArrangeAfterLbSync()
}

function autoArrangeAfterLbSync(): void {
  applyAutoArrange({ recordHistory: false })
}

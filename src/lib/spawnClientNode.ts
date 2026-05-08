import { idleClientLoadgenBucket } from './clientMetrics'
import { defaultEdgeProtocol } from './defaultEdgeProtocol'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'

export const CLIENT_LOADGEN_ID = 'client-loadgen'

/** Ensures the client row exists in metrics (idle) whenever the node is on the canvas. */
export function ensureClientLoadgenMetrics(): void {
  if (!useCanvasStore.getState().nodes[CLIENT_LOADGEN_ID]) return
  useMetricsStore.getState().updateMetrics(CLIENT_LOADGEN_ID, idleClientLoadgenBucket())
}

/** Adds the traffic-source node and edge to the LB or first compute, if missing. */
export function spawnClientLoadgenNode(): void {
  const st = useCanvasStore.getState()
  if (st.nodes[CLIENT_LOADGEN_ID]) return

  const nodeValues = Object.values(st.nodes)
  const entryNode =
    nodeValues.find((n) => n.type === 'load_balancer') ??
    nodeValues.find((n) => n.type === 'compute')
  if (!entryNode) return

  st.addNode({
    id: CLIENT_LOADGEN_ID,
    type: 'client',
    position: [entryNode.position[0] - 3, 0.3, entryNode.position[2]],
    label: 'Traffic Source',
    config: {},
    status: 'healthy',
  })
  st.addEdge({
    id: `edge-client-${entryNode.id}`,
    sourceId: CLIENT_LOADGEN_ID,
    targetId: entryNode.id,
    protocol: defaultEdgeProtocol('client', entryNode.type),
    animated: true,
  })
  useMetricsStore.getState().updateMetrics(CLIENT_LOADGEN_ID, idleClientLoadgenBucket())
}

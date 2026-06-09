import { createCanvasNode } from './nodeFactory'
import { recordCanvasHistory } from './canvasHistory'
import { APP_SERVER_REPLICA_MAX } from './replicaConfig'
import {
  useCanvasStore,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'

const REPLICA_LIMITS: Partial<Record<CanvasNode['type'], number>> = {
  compute: APP_SERVER_REPLICA_MAX,
  worker: 10,
  cache: 20,
  database: 10,
}

/**
 * Nodes are 1.4 world-units wide. Use a generous snap radius so the user
 * doesn't have to land dead-center — anywhere roughly over the node counts.
 */
const SNAP_RADIUS = 1.5

function canScaleByReplica(type: CanvasNode['type']): boolean {
  return type in REPLICA_LIMITS
}

function distXZ(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Places a new node from the picker, unless the user dropped the same
 * component type close enough to an existing node of that type, in which case
 * we increment that node's replica count instead of spawning a duplicate.
 */
export function placeFromPicker(params: {
  nodeType: CanvasNode['type']
  position: [number, number, number]
  nodes: Record<string, CanvasNode>
  addNode: (node: CanvasNode) => void
  updateNodeConfig: (id: string, config: Partial<CanvasNode['config']>) => void
  selectNode: (id: string | null) => void
}): string {
  const {
    nodeType,
    position,
    nodes,
    addNode,
    updateNodeConfig,
    selectNode,
  } = params

  // Find the nearest node of the same type within snap radius.
  let existing: CanvasNode | undefined
  let bestDist = SNAP_RADIUS
  for (const n of Object.values(nodes)) {
    if (n.type !== nodeType) continue
    const d = distXZ(n.position, position)
    if (d <= bestDist) {
      bestDist = d
      existing = n
    }
  }

  if (existing && canScaleByReplica(nodeType)) {
    const maxReplicas = REPLICA_LIMITS[nodeType] ?? 20
    const current = Number(
      nodeType === 'database'
        ? (existing.config.readReplicas ?? 0)
        : (existing.config.replicas ?? 1)
    )
    const safeCurrent = Number.isFinite(current)
      ? (nodeType === 'database'
        ? Math.max(0, Math.floor(current))
        : Math.max(1, Math.floor(current)))
      : (nodeType === 'database' ? 0 : 1)
    const next = Math.min(maxReplicas, safeCurrent + 1)
    if (next !== safeCurrent) {
      const st = useCanvasStore.getState()
      recordCanvasHistory(st.nodes, st.edges)
      updateNodeConfig(
        existing.id,
        nodeType === 'database' ? { readReplicas: next } : { replicas: next },
      )
    }
    selectNode(existing.id)
    return existing.id
  }

  const node = createCanvasNode(nodeType, position, nodes)
  addNode(node)
  selectNode(node.id)
  return node.id
}

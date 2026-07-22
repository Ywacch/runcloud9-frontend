import { createCanvasNode } from './nodeFactory'
import { recordCanvasHistory } from './canvasHistory'
import { APP_SERVER_REPLICA_MAX } from './replicaConfig'
import {
  useCanvasStore,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import { useAuthStore } from '../product/stores/authStore'
import { maxAppServerReplicasForUser } from './userTier'
import { seedWriteBehindIntervalDefault } from './writeBehindInterval'
import { seedCacheTtlSecondsDefault } from './cacheTtl'

function maxReplicasForType(type: CanvasNode['type']): number {
  if (type !== 'compute') return APP_SERVER_REPLICA_MAX
  const { currentUser, userRecord } = useAuthStore.getState()
  return (
    currentUser?.limits.maxAppServerReplicas ??
    maxAppServerReplicasForUser(userRecord)
  )
}

function canScaleByReplica(type: CanvasNode['type']): boolean {
  return type === 'compute'
}

/**
 * Nodes are 1.4 world-units wide. Use a generous snap radius so the user
 * doesn't have to land dead-center — anywhere roughly over the node counts.
 */
const SNAP_RADIUS = 1.5

function distXZ(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Places a new node from the picker. For app servers (`compute`), dropping the
 * same type close enough to an existing node increments replicas instead of
 * spawning a duplicate. All other component types always create a new node.
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
    const maxReplicas = maxReplicasForType(nodeType)
    const current = Number(existing.config.replicas ?? 1)
    const safeCurrent = Number.isFinite(current)
      ? Math.max(1, Math.floor(current))
      : 1
    const next = Math.min(maxReplicas, safeCurrent + 1)
    if (next !== safeCurrent) {
      const st = useCanvasStore.getState()
      recordCanvasHistory(st.nodes, st.edges)
      updateNodeConfig(existing.id, { replicas: next })
    }
    selectNode(existing.id)
    return existing.id
  }

  const node = createCanvasNode(nodeType, position, nodes)
  if (node.type === 'cache') {
    const templateId = useCanvasStore.getState().snapshotTemplateId
    node.config = seedCacheTtlSecondsDefault(
      seedWriteBehindIntervalDefault(node.config, templateId),
      templateId,
    )
  }
  addNode(node)
  selectNode(node.id)
  return node.id
}

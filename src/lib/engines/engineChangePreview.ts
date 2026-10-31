import type { CanvasNode, CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import { buildJobsPanelModel } from './jobsPanelModel'

export interface EngineChangePreview {
  jobId: string
  engine: string
  /** Nodes that would disappear if this engine is chosen. */
  removeNodeIds: string[]
  /** Job binds to this existing node (consolidation). */
  bindToNodeId: string | null
  /** Engine patch stays on this node (in-place swap). */
  patchNodeId: string | null
  summary: string
}

function canvasTypeForEngine(engine: string): CanvasNode['type'] | null {
  switch (engine) {
    case 'postgresql':
    case 'mysql':
      return 'database'
    case 'redis':
    case 'memcached':
    case 'valkey':
      return 'cache'
    case 'rabbitmq':
      return 'message_queue'
    default:
      return null
  }
}

function nodeLabel(nodes: CanvasNode[], id: string | null): string {
  if (!id) return 'another node'
  return nodes.find((n) => n.id === id)?.label ?? id
}

/**
 * What the canvas would look like if `jobId` ran on `engine`.
 * In-place swaps only change the current node. Cross-type engines
 * (timeline on Postgres) bind onto an existing node and drop the old one
 * when nothing else uses it.
 */
export function previewJobEngineChange(
  snapshot: CanvasSnapshot,
  jobId: string,
  engine: string,
): EngineChangePreview {
  const nodes = snapshot.nodes
  const rows = buildJobsPanelModel(snapshot, null)
  const row = rows.find((r) => r.jobId === jobId)
  const currentId = row?.nodeId ?? null
  const current = currentId ? nodes.find((n) => n.id === currentId) : undefined
  const targetType = canvasTypeForEngine(engine)
  const eng = engine.trim().toLowerCase()

  const empty: EngineChangePreview = {
    jobId,
    engine: eng,
    removeNodeIds: [],
    bindToNodeId: null,
    patchNodeId: currentId,
    summary: `${row?.jobLabel ?? jobId} stays on ${nodeLabel(nodes, currentId)}`,
  }

  if (!current || !targetType) return empty

  if (current.type === targetType) {
    return {
      ...empty,
      patchNodeId: current.id,
      bindToNodeId: null,
      summary: `${current.label} runs ${eng}`,
    }
  }

  const host =
    nodes.find((n) => n.type === targetType && n.id !== current.id) ?? null
  if (!host) {
    return {
      ...empty,
      patchNodeId: null,
      summary: `No ${targetType.replace('_', ' ')} node to host ${eng}`,
    }
  }

  const othersOnCurrent = rows.filter(
    (r) => r.jobId !== jobId && r.nodeId === current.id,
  )
  const remove = othersOnCurrent.length === 0 ? [current.id] : []

  return {
    jobId,
    engine: eng,
    removeNodeIds: remove,
    bindToNodeId: host.id,
    patchNodeId: null,
    summary: remove.length
      ? `${row?.jobLabel ?? jobId} moves onto ${host.label}. ${current.label} is removed.`
      : `${row?.jobLabel ?? jobId} moves onto ${host.label}.`,
  }
}

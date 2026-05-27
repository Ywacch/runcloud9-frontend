import type { TemplatePreset } from './api'
import type { CanvasEdge, CanvasNode, CanvasSnapshot } from '../editor-core/stores/canvasStore'

const CANVAS_NODE_TYPES = new Set<CanvasNode['type']>([
  'load_balancer',
  'compute',
  'database',
  'cache',
  'message_queue',
  'worker',
  'client',
])

function toCanvasNodeType(raw: string): CanvasNode['type'] | null {
  return CANVAS_NODE_TYPES.has(raw as CanvasNode['type'])
    ? (raw as CanvasNode['type'])
    : null
}

function toCanvasProtocol(raw: string): CanvasEdge['protocol'] {
  return raw === 'tcp' ? 'tcp' : 'http'
}

/**
 * Convert server template preset into a runtime-ready canvas snapshot.
 * Runtime-only fields are set here (node status + edge animation).
 */
export function templatePresetToCanvasSnapshot(
  preset: TemplatePreset,
  templateId: string
): CanvasSnapshot {
  const nodes: CanvasNode[] = []
  for (const n of preset.nodes) {
    const type = toCanvasNodeType(n.type)
    if (!type) continue
    nodes.push({
      id: n.id,
      type,
      position: n.position,
      label: n.label,
      config: { ...(n.config ?? {}) },
      status: 'idle',
    })
  }

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: CanvasEdge[] = []
  for (const e of preset.edges) {
    if (!nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId)) continue
    edges.push({
      id: e.id,
      sourceId: e.sourceId,
      targetId: e.targetId,
      protocol: toCanvasProtocol(e.protocol),
      animated: false,
    })
  }

  return {
    version: '1.0',
    templateId,
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  }
}

import { backendComponentToCanvasType, canvasToBackend } from './typeMapping'
import type { CanvasNode, CanvasSnapshot, CanvasEdge } from '../store/canvasStore'
import type { DeploymentDesign } from './api'

export function snapshotToDeploymentDesign(
  snapshot: CanvasSnapshot
): DeploymentDesign {
  const clientIds = new Set(
    snapshot.nodes.filter((n) => n.type === 'client').map((n) => n.id),
  )
  const nodes = snapshot.nodes
    .filter((n) => n.type !== 'client')
    .map((n) => ({
      id: n.id,
      type: canvasToBackend[n.type],
      name: n.label,
      config: { ...n.config },
    }))
  const connections = snapshot.edges
    .filter(
      (e) => !clientIds.has(e.sourceId) && !clientIds.has(e.targetId),
    )
    .map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      protocol: e.protocol,
    }))
  if (!snapshot.templateId?.trim()) {
    throw new Error('no template selected')
  }
  return {
    version: snapshot.version,
    template: snapshot.templateId,
    archetype: 'standard',
    nodes,
    connections,
  }
}

export function deploymentDesignToSnapshot(
  design: DeploymentDesign,
  templateId: string
): CanvasSnapshot {
  const now = new Date().toISOString()

  // Simple grid layout: spread nodes horizontally, single row.
  const nodes: CanvasNode[] = design.nodes.map((n, idx) => {
    const type = backendComponentToCanvasType[n.type] ?? 'compute'
    const x = idx * 2
    const z = 0
    return {
      id: n.id,
      type,
      // Keep baseline elevation consistent with runtime canvas placement.
      position: [x, 0.3, z],
      label: n.name || n.id,
      config: { ...n.config },
      status: 'idle',
    }
  })

  const edges: CanvasEdge[] = design.connections.map((c, idx) => ({
    id: `edge-${idx}`,
    sourceId: c.sourceId,
    targetId: c.targetId,
    protocol: 'http',
    animated: false,
  }))

  return {
    version: '1.0',
    templateId,
    nodes,
    edges,
    exportedAt: now,
  }
}

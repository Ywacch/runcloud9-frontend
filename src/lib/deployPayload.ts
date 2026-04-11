import { canvasToBackend } from './typeMapping'
import type { CanvasSnapshot } from '../store/canvasStore'
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

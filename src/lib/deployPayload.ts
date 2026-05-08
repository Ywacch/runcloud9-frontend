import { backendComponentToCanvasType, canvasToBackend } from './typeMapping'
import type { CanvasNode, CanvasSnapshot, CanvasEdge } from '../store/canvasStore'
import type { DeploymentDesign } from './api'

/**
 * Backend topology validation and env derivation typically read `strategy` on cache
 * nodes. The canvas inspector uses `cacheStrategy`. Keep both in sync on the wire.
 */
export function deployConfigForNode(n: CanvasNode): Record<string, unknown> {
  const config = { ...n.config } as Record<string, unknown>
  // Prelaunch gating: keep payloads minimal and avoid emitting inactive knobs.
  delete config.maxMemory
  delete config.maxMemoryMB
  delete config.evictionPolicy
  delete config.durableQueues
  delete config.durable
  delete config.storageSize
  delete config.storageGB
  delete config.maxConnections
  // Launch default: keep single replica semantics in deploy payload.
  config.replicas = '1'
  if (n.type === 'cache') {
    const strat = String(
      config.cacheStrategy ?? config.strategy ?? 'cache-aside',
    )
    config.cacheStrategy = strat
    config.strategy = strat
  }
  return config
}

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
      config: deployConfigForNode(n),
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
    const raw = { ...n.config } as Record<string, unknown>
    if (type === 'cache' && raw.cacheStrategy == null && raw.strategy != null) {
      raw.cacheStrategy = raw.strategy
    }
    return {
      id: n.id,
      type,
      // Keep baseline elevation consistent with runtime canvas placement.
      position: [x, 0.3, z],
      label: n.name || n.id,
      config: raw,
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

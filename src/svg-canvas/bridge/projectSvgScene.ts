import type { CanvasEdge, CanvasNode } from '../../editor-core/stores/canvasStore'
import { syncZoneForNode } from '../compose/syncZoneForNode'
import { attachPair } from '../routing/attach'
import { routeIsoManhattan } from '../routing/isoManhattan'
import { collectObstacleCells } from '../routing/obstacles'
import { defaultEdgeStyle, type SvgEdge, type SvgNode, type SvgZone } from '../store/svgTypes'
import { canvasNodeToSvgNode } from './canvasSvgAdapter'

/** Stable edge order at a node so attach slots don't shuffle. */
function edgeSlotsForNode(
  edges: { id: string; sourceId: string; targetId: string }[],
  nodeId: string,
): Map<string, { slot: number; count: number }> {
  const touching = edges
    .filter((e) => e.sourceId === nodeId || e.targetId === nodeId)
    .map((e) => e.id)
    .sort()
  const count = touching.length
  const map = new Map<string, { slot: number; count: number }>()
  touching.forEach((id, slot) => map.set(id, { slot, count }))
  return map
}

function routeBetween(
  nodes: SvgNode[],
  zones: SvgZone[],
  canvasEdges: { id: string; sourceId: string; targetId: string }[],
  sourceId: string,
  targetId: string,
  edgeId: string,
): { x: number; y: number }[] {
  const source = nodes.find((n) => n.id === sourceId)
  const target = nodes.find((n) => n.id === targetId)
  if (!source || !target) return []
  const sourceSlots = edgeSlotsForNode(canvasEdges, sourceId)
  const targetSlots = edgeSlotsForNode(canvasEdges, targetId)
  const s = sourceSlots.get(edgeId) ?? { slot: 0, count: 1 }
  const t = targetSlots.get(edgeId) ?? { slot: 0, count: 1 }
  const ports = attachPair(source, target, {
    sourceSlot: s.slot,
    sourceSlotCount: s.count,
    targetSlot: t.slot,
    targetSlotCount: t.count,
  })
  const obstacleCells = collectObstacleCells(
    nodes,
    zones,
    new Set([sourceId, targetId]),
  )
  return routeIsoManhattan({
    source: ports.source,
    target: ports.target,
    obstacleCells,
  })
}

export function rebuildZones(nodes: SvgNode[]): SvgZone[] {
  const zones: SvgZone[] = []
  for (const n of nodes) {
    const z = syncZoneForNode(n)
    if (z) zones.push(z)
  }
  return zones
}

export type ProjectedSvgScene = {
  nodes: SvgNode[]
  edges: SvgEdge[]
  zones: SvgZone[]
}

/** Project product canvas topology into SVG scene graph (waypoints + zones derived). */
export function projectSvgScene(
  canvasNodes: Record<string, CanvasNode>,
  canvasEdges: Record<string, CanvasEdge>,
): ProjectedSvgScene {
  const nodes = Object.values(canvasNodes).map(canvasNodeToSvgNode)
  const byId = new Set(nodes.map((n) => n.id))
  const zones = rebuildZones(nodes)
  const edgeList = Object.values(canvasEdges)
    .filter((e) => byId.has(e.sourceId) && byId.has(e.targetId))
    .map((e) => ({ id: e.id, sourceId: e.sourceId, targetId: e.targetId }))
  const edges: SvgEdge[] = Object.values(canvasEdges)
    .filter((e) => byId.has(e.sourceId) && byId.has(e.targetId))
    .map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceId,
      targetNodeId: e.targetId,
      waypoints: routeBetween(
        nodes,
        zones,
        edgeList,
        e.sourceId,
        e.targetId,
        e.id,
      ),
      style: defaultEdgeStyle(),
      trafficEnabled: e.animated === true,
      protocol: e.protocol === 'tcp' ? ('tcp' as const) : ('http' as const),
    }))
  return { nodes, edges, zones }
}

export function rerouteSvgEdgesForNodes(
  nodes: SvgNode[],
  edges: SvgEdge[],
  nodeIds: string[],
): SvgEdge[] {
  if (nodeIds.length === 0) return edges
  const moved = new Set(nodeIds)
  const zones = rebuildZones(nodes)
  const edgeList = edges.map((e) => ({
    id: e.id,
    sourceId: e.sourceNodeId,
    targetId: e.targetNodeId,
  }))
  return edges.map((e) => {
    if (!moved.has(e.sourceNodeId) && !moved.has(e.targetNodeId)) return e
    return {
      ...e,
      waypoints: routeBetween(
        nodes,
        zones,
        edgeList,
        e.sourceNodeId,
        e.targetNodeId,
        e.id,
      ),
    }
  })
}

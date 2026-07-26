import type { CanvasEdge, CanvasNode } from '../../editor-core/stores/canvasStore'
import { syncZoneForNode } from '../compose/syncZoneForNode'
import { attachPair } from '../routing/attach'
import { routeIsoManhattan } from '../routing/isoManhattan'
import { collectObstacleCells } from '../routing/obstacles'
import { defaultEdgeStyle, type SvgEdge, type SvgNode, type SvgZone } from '../store/svgTypes'
import { canvasNodeToSvgNode } from './canvasSvgAdapter'

function routeBetween(
  nodes: SvgNode[],
  zones: SvgZone[],
  sourceId: string,
  targetId: string,
): { x: number; y: number }[] {
  const source = nodes.find((n) => n.id === sourceId)
  const target = nodes.find((n) => n.id === targetId)
  if (!source || !target) return []
  const ports = attachPair(source, target)
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
  const edges: SvgEdge[] = Object.values(canvasEdges)
    .filter((e) => byId.has(e.sourceId) && byId.has(e.targetId))
    .map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceId,
      targetNodeId: e.targetId,
      waypoints: routeBetween(nodes, zones, e.sourceId, e.targetId),
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
  return edges.map((e) => {
    if (!moved.has(e.sourceNodeId) && !moved.has(e.targetNodeId)) return e
    return {
      ...e,
      waypoints: routeBetween(nodes, zones, e.sourceNodeId, e.targetNodeId),
    }
  })
}

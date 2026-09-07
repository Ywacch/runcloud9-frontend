import type { CanvasEdge, CanvasNode } from '../../editor-core/stores/canvasStore'
import { syncZoneForNode } from '../compose/syncZoneForNode'
import { routeConnectorScene } from '../routing/connectorSegments'
import { defaultEdgeStyle, type SvgEdge, type SvgNode, type SvgZone } from '../store/svgTypes'
import { canvasNodeToSvgNode } from './canvasSvgAdapter'

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
  const routes = routeConnectorScene({ nodes, zones, edges: edgeList })
  const edges: SvgEdge[] = Object.values(canvasEdges)
    .filter((e) => byId.has(e.sourceId) && byId.has(e.targetId))
    .map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceId,
      targetNodeId: e.targetId,
      waypoints: routes.get(e.id) ?? [],
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
  const zones = rebuildZones(nodes)
  const edgeList = edges.map((e) => ({
    id: e.id,
    sourceId: e.sourceNodeId,
    targetId: e.targetNodeId,
  }))
  const routes = routeConnectorScene({ nodes, zones, edges: edgeList })
  return edges.map((e) => ({
    ...e,
    waypoints: routes.get(e.id) ?? e.waypoints,
  }))
}

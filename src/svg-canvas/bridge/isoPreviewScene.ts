import type { CanvasEdge, CanvasNode, CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import type { WorldPoint } from '../math/iso'
import { projectSvgScene, type ProjectedSvgScene } from './projectSvgScene'

export function snapshotRecords(snapshot: CanvasSnapshot): {
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
} {
  return {
    nodes: Object.fromEntries(snapshot.nodes.map((n) => [n.id, n])),
    edges: Object.fromEntries(snapshot.edges.map((e) => [e.id, e])),
  }
}

export function projectedSceneFromSnapshot(
  snapshot: CanvasSnapshot,
): ProjectedSvgScene {
  const { nodes, edges } = snapshotRecords(snapshot)
  return projectSvgScene(nodes, edges)
}

export function previewWorldPoints(scene: ProjectedSvgScene): WorldPoint[] {
  const points: WorldPoint[] = scene.nodes.map((n) => ({ x: n.x, y: n.y }))
  for (const edge of scene.edges) {
    for (const p of edge.waypoints) points.push(p)
  }
  return points
}

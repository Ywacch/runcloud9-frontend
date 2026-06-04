import { TILE_H, isoToScreen } from '../constants'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { nodeToIso } from './positionAdapter'

/** Bottom vertex of the iso top face — natural connection port for an iso cube. */
export function getConnectionPoint(node: CanvasNode): { x: number; y: number } {
  const { col, row } = nodeToIso(node.position)
  const s = isoToScreen(col, row)
  return { x: s.x, y: s.y + TILE_H }
}

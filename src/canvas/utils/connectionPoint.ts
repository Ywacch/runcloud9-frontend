import { isoToScreen, tileConnectionOffset } from '../constants'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { nodeToIso } from './positionAdapter'

/** Bottom-center of the iso top face — natural connection port for a block. */
export function getConnectionPoint(node: CanvasNode): { x: number; y: number } {
  const { col, row } = nodeToIso(node.position)
  const s = isoToScreen(col, row)
  const port = tileConnectionOffset()
  return { x: s.x + port.x, y: s.y + port.y }
}

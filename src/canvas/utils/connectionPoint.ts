import { TILE_W, TILE_H, isoToScreen } from '../constants'
import { COMPONENT_COLORS } from '../config/componentColors'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { nodeToIso } from './positionAdapter'

export interface ConnectionPort {
  x: number
  y: number
  floorY: number
}

/** Visual port on the component body plus floor anchor for isometric routing. */
export function getConnectionPoint(node: CanvasNode): ConnectionPort {
  const { col, row } = nodeToIso(node.position)
  const s = isoToScreen(col, row)
  const colors = COMPONENT_COLORS[node.type]
  const sH = colors?.sideHeight ?? 30

  const floorX = s.x + TILE_W / 2
  const floorY = s.y + TILE_H / 2

  return {
    x: floorX,
    y: s.y - sH / 3,
    floorY,
  }
}

/** Cursor / preview target without a backing node. */
export function connectionPortAt(x: number, y: number, floorY = y): ConnectionPort {
  return { x, y, floorY }
}

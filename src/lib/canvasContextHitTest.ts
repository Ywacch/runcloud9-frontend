import { TILE_H, TILE_W, screenToIso } from '../canvas/constants'
import { clampIsoCell, isoToNode, nodeToIso } from '../canvas/utils/positionAdapter'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { Viewport } from 'pixi-viewport'

/** Match pickerPlacement snap — roughly over the node footprint. */
const HIT_RADIUS_STORE = 1.6

function distXZ(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dz * dz)
}

export function canvasClientToWorldPos(
  viewport: Viewport,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): {
  worldX: number
  worldY: number
  position: [number, number, number]
} {
  const rect = canvas.getBoundingClientRect()
  const canvasX = clientX - rect.left
  const canvasY = clientY - rect.top
  const world = viewport.toWorld(canvasX, canvasY)
  const iso = screenToIso(world.x, world.y)
  const { col, row } = clampIsoCell(iso.col, iso.row)
  return {
    worldX: world.x,
    worldY: world.y,
    position: isoToNode(col, row),
  }
}

/** Nearest node under pointer, or null if empty canvas. */
export function findNodeIdAtClientPoint(
  viewport: Viewport,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  nodes: Record<string, CanvasNode>,
): string | null {
  const rect = canvas.getBoundingClientRect()
  const world = viewport.toWorld(clientX - rect.left, clientY - rect.top)
  // Fractional iso → store units (cells are 2 units apart).
  const rawCol = world.x / TILE_W - world.y / TILE_H
  const rawRow = world.x / TILE_W + world.y / TILE_H
  const clickPos: [number, number, number] = [rawCol * 2, 0.3, rawRow * 2]

  let bestId: string | null = null
  let bestDist = HIT_RADIUS_STORE
  for (const [id, n] of Object.entries(nodes)) {
    const d = distXZ(n.position, clickPos)
    if (d <= bestDist) {
      bestDist = d
      bestId = id
    }
  }
  return bestId
}

/** Debug / tests: node whose iso cell equals the click cell. */
export function findNodeIdAtIsoCell(
  nodes: Record<string, CanvasNode>,
  col: number,
  row: number,
): string | null {
  for (const [id, n] of Object.entries(nodes)) {
    const cell = nodeToIso(n.position)
    if (cell.col === col && cell.row === row) return id
  }
  return null
}

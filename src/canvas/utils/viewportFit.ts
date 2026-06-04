import type { Viewport } from 'pixi-viewport'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { TILE_W, TILE_H, isoToScreen } from '../constants'
import { nodeToIso } from './positionAdapter'

export function fitViewportToNodes(
  viewport: Viewport,
  nodes: Record<string, CanvasNode>,
): void {
  const list = Object.values(nodes)
  if (list.length === 0) return

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of list) {
    const { col, row } = nodeToIso(node.position)
    const s = isoToScreen(col, row)
    minX = Math.min(minX, s.x - TILE_W / 2)
    minY = Math.min(minY, s.y - 20)
    maxX = Math.max(maxX, s.x + TILE_W / 2)
    maxY = Math.max(maxY, s.y + TILE_H + 80)
  }

  const boundsW = Math.max(maxX - minX, TILE_W)
  const boundsH = Math.max(maxY - minY, TILE_H + 80)
  const padX = viewport.screenWidth * 0.175
  const padY = viewport.screenHeight * 0.175
  const scaleX = (viewport.screenWidth - padX * 2) / boundsW
  const scaleY = (viewport.screenHeight - padY * 2) / boundsH
  const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.4)

  if (!Number.isFinite(scale) || scale <= 0) return

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  // Center first, then zoom without restoring the pre-zoom camera (setZoom(true)
  // would snap back to grid center and undo this).
  viewport.moveCenter(cx, cy)
  viewport.setZoom(scale, false)
}

export function nodeTopologyKey(nodes: Record<string, CanvasNode>): string {
  return Object.keys(nodes).sort().join(',')
}

export function topologyDelta(
  prevKey: string,
  nextKey: string,
): { added: number; removed: number } {
  const prev = new Set(prevKey ? prevKey.split(',') : [])
  const next = new Set(nextKey ? nextKey.split(',') : [])
  let added = 0
  for (const id of next) {
    if (!prev.has(id)) added++
  }
  let removed = 0
  for (const id of prev) {
    if (!next.has(id)) removed++
  }
  return { added, removed }
}

/** True when the store change looks like a template load or bulk replace. */
export function shouldFitViewportToNodes(
  prevKey: string,
  nextKey: string,
  prevCount: number,
  nextCount: number,
): boolean {
  if (nextCount === 0) return false
  if (prevCount === 0) return true
  const { added, removed } = topologyDelta(prevKey, nextKey)
  if (added >= 2) return true
  if (removed >= 1 && added >= 1) return true
  return false
}

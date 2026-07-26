/**
 * Export framing — zoom-independent.
 * - bounded: entire fixed floor slab
 * - infinite / off: design (nodes) + padding around it
 */

import {
  BOUNDED_COLS,
  BOUNDED_MAJOR_COLS,
  BOUNDED_MAJOR_ROWS,
  BOUNDED_ROWS,
  BOUNDED_SLAB_THICKNESS,
  type GridMode,
} from '../components/Floor'
import { isoFootprintDiamond, type WorldPoint } from '../math/iso'

export type ExportViewBox = { x: number; y: number; w: number; h: number }

const MIN_CONTENT = 240
const DESIGN_PAD = 280
const BOUNDED_PAD = 28

const BOUNDED_ORIGIN_I = -BOUNDED_MAJOR_COLS + 0.5
const BOUNDED_ORIGIN_J = -BOUNDED_MAJOR_ROWS + 0.5

function aabbOf(points: readonly WorldPoint[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

function viewBoxFromAabb(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  pad: number,
  minSize: number,
): ExportViewBox {
  let w = Math.max(box.maxX - box.minX, minSize) + pad * 2
  let h = Math.max(box.maxY - box.minY, minSize) + pad * 2
  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** World AABB of the bounded slab (top + extruded sides). */
export function boundedFloorWorldPoints(): WorldPoint[] {
  const top = isoFootprintDiamond(
    BOUNDED_ORIGIN_I,
    BOUNDED_ORIGIN_J,
    BOUNDED_COLS,
    BOUNDED_ROWS,
  )
  return [
    ...top,
    { x: top[2].x, y: top[2].y + BOUNDED_SLAB_THICKNESS },
    { x: top[3].x, y: top[3].y + BOUNDED_SLAB_THICKNESS },
    { x: top[1].x, y: top[1].y + BOUNDED_SLAB_THICKNESS },
  ]
}

/** Export frame covering the full bounded grid (ignores zoom). */
export function boundedFloorExportViewBox(pad = BOUNDED_PAD): ExportViewBox {
  return viewBoxFromAabb(aabbOf(boundedFloorWorldPoints()), pad, MIN_CONTENT)
}

/** Export frame around the design with padding (infinite / off). */
export function designExportViewBox(
  nodes: readonly { x: number; y: number }[],
  pad = DESIGN_PAD,
): ExportViewBox {
  if (nodes.length === 0) {
    const w = 900
    const h = 600
    return { x: -w / 2, y: -h / 2, w, h }
  }
  return viewBoxFromAabb(aabbOf(nodes), pad, MIN_CONTENT)
}

/** Pick export frame from grid mode — never uses the live camera. */
export function resolveExportViewBox(options: {
  gridMode: GridMode
  nodes: readonly { x: number; y: number }[]
}): ExportViewBox {
  if (options.gridMode === 'bounded') {
    return boundedFloorExportViewBox()
  }
  return designExportViewBox(options.nodes)
}

export function viewBoxAttr(vb: ExportViewBox): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
}

/** @deprecated use designExportViewBox */
export function computeExportViewBox(
  nodes: readonly { x: number; y: number }[],
  _aspect = 16 / 9,
): ExportViewBox {
  return designExportViewBox(nodes)
}

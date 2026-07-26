/**
 * Content-fitted viewBox for SVG export (independent of the live camera).
 */

export type ExportViewBox = { x: number; y: number; w: number; h: number }

const MIN_VIEW = 400
const MAX_VIEW = 8000
const PAD = 320

export function computeExportViewBox(
  nodes: readonly { x: number; y: number }[],
  aspect = 16 / 9,
): ExportViewBox {
  if (nodes.length === 0) {
    const h = 780
    const w = h * aspect
    return { x: -w / 2, y: -h / 2, w, h }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x)
    maxY = Math.max(maxY, n.y)
  }

  const contentW = Math.max(maxX - minX, 160) + PAD * 2
  const contentH = Math.max(maxY - minY, 160) + PAD * 2
  let w = contentW
  let h = contentH
  if (w / h > aspect) h = w / aspect
  else w = h * aspect
  w = Math.min(MAX_VIEW, Math.max(MIN_VIEW, w))
  h = w / aspect
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

export function viewBoxAttr(vb: ExportViewBox): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
}

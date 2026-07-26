/**
 * Export framing helpers — default is the live camera (full on-screen canvas).
 */

export type ExportViewBox = { x: number; y: number; w: number; h: number }

export type ExportFrame = 'viewport' | 'content'

const MIN_VIEW = 400
const MAX_VIEW = 8000
const PAD = 320

export function parseViewBoxAttr(raw: string | null | undefined): ExportViewBox | null {
  if (!raw) return null
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [x, y, w, h] = parts
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

/** Read the live SVG camera viewBox (what the user currently sees). */
export function readSvgViewBox(svg: {
  viewBox?: { baseVal?: { x: number; y: number; width: number; height: number } }
  getAttribute: (name: string) => string | null
}): ExportViewBox | null {
  const base = svg.viewBox?.baseVal
  if (
    base &&
    Number.isFinite(base.width) &&
    Number.isFinite(base.height) &&
    base.width > 0 &&
    base.height > 0
  ) {
    return { x: base.x, y: base.y, w: base.width, h: base.height }
  }
  return parseViewBoxAttr(svg.getAttribute('viewBox'))
}

/** Content-fitted viewBox around node tips (optional tight crop). */
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

/**
 * Resolve export frame: viewport = live camera (full canvas); content = node crop.
 */
export function resolveExportViewBox(options: {
  frame?: ExportFrame
  liveViewBox: ExportViewBox | null
  nodes: readonly { x: number; y: number }[]
  aspect?: number
}): ExportViewBox {
  const frame = options.frame ?? 'viewport'
  if (frame === 'content') {
    return computeExportViewBox(options.nodes, options.aspect ?? 16 / 9)
  }
  if (options.liveViewBox) return options.liveViewBox
  return computeExportViewBox(options.nodes, options.aspect ?? 16 / 9)
}

export function viewBoxAttr(vb: ExportViewBox): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
}

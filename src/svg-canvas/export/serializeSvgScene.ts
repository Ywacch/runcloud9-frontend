import type { GridMode } from '../components/Floor'
import {
  infiniteFloorDiamond,
  pointsAttr,
} from '../math/iso'
import { EXPORT_STRIP_QUERY } from './exportStrip'
import {
  resolveExportViewBox,
  viewBoxAttr,
  type ExportViewBox,
} from './exportViewBox'
import {
  fetchAssetAsDataUri,
  type FetchBytes,
} from './inlineImages'

export type SerializeSvgSceneOptions = {
  nodes: readonly { x: number; y: number }[]
  /** Current grid mode — drives zoom-independent framing. */
  gridMode: GridMode
  /** Pixel size on the root SVG (defaults from viewBox). */
  width?: number
  height?: number
  /** Host fill behind the floor (matches canvas floor theme). */
  background?: string
  fetchBytes?: FetchBytes
}

/**
 * Clone a live design SVG into a standalone file.
 * Framing ignores zoom:
 * - bounded → full floor slab + contents
 * - infinite / off → design + padding (floor retargeted to that frame)
 */
export async function serializeSvgScene(
  source: SVGSVGElement,
  options: SerializeSvgSceneOptions,
): Promise<string> {
  const clone = source.cloneNode(true) as SVGSVGElement
  stripExportNoise(clone)

  const vb = resolveExportViewBox({
    gridMode: options.gridMode,
    nodes: options.nodes,
  })
  applyRootAttrs(clone, vb, options.width, options.height)
  ensureExportBackground(clone, vb, options.background)
  retargetCameraFloor(clone, options.gridMode, vb)

  await inlineCloneImages(clone, options.fetchBytes)

  const serialized = new XMLSerializer().serializeToString(clone)
  return serialized.includes('xmlns=')
    ? serialized
    : serialized.replace(
        /^<svg\b/,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      )
}

export function stripExportNoise(root: ParentNode): void {
  root.querySelectorAll(EXPORT_STRIP_QUERY).forEach((el) => el.remove())
}

function applyRootAttrs(
  svg: SVGSVGElement,
  vb: ExportViewBox,
  width?: number,
  height?: number,
): void {
  svg.setAttribute('viewBox', viewBoxAttr(vb))
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const w = width ?? Math.round(vb.w)
  const h = height ?? Math.round(vb.h)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))
  svg.removeAttribute('class')
  svg.removeAttribute('style')
}

/** Full-rect host fill so export matches the in-app canvas. */
export function ensureExportBackground(
  svg: SVGSVGElement,
  vb: ExportViewBox,
  fill?: string,
): void {
  if (!fill) return
  svg.querySelectorAll('[data-export-bg]').forEach((el) => el.remove())
  const rect = svg.ownerDocument.createElementNS(
    'http://www.w3.org/2000/svg',
    'rect',
  )
  rect.setAttribute('data-export-bg', '')
  rect.setAttribute('x', String(vb.x))
  rect.setAttribute('y', String(vb.y))
  rect.setAttribute('width', String(vb.w))
  rect.setAttribute('height', String(vb.h))
  rect.setAttribute('fill', fill)

  const floor = svg.querySelector('[data-floor]')
  if (floor?.parentNode) {
    floor.parentNode.insertBefore(rect, floor)
  } else {
    svg.insertBefore(rect, svg.firstChild)
  }
}

/**
 * Infinite / off floors are painted for the live camera — rewrite their
 * polygons so the export frame still has a proper floor under the design.
 */
export function retargetCameraFloor(
  svg: SVGSVGElement,
  gridMode: GridMode,
  vb: ExportViewBox,
): void {
  if (gridMode === 'bounded') return
  const floor = svg.querySelector(`[data-floor="${gridMode}"]`)
  if (!floor) return
  const pts = pointsAttr(
    infiniteFloorDiamond(vb.x, vb.y, vb.w, vb.h),
  )
  floor.querySelectorAll('polygon').forEach((poly) => {
    poly.setAttribute('points', pts)
  })
}

async function inlineCloneImages(
  root: ParentNode,
  fetchBytes?: FetchBytes,
): Promise<void> {
  const images = Array.from(root.querySelectorAll('image'))
  const cache = new Map<string, string>()

  for (const img of images) {
    const href =
      img.getAttribute('href') ??
      img.getAttribute('xlink:href') ??
      img.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
    if (!href || href.startsWith('data:')) continue

    let dataUri = cache.get(href)
    if (!dataUri) {
      dataUri = await fetchAssetAsDataUri(href, fetchBytes)
      cache.set(href, dataUri)
    }
    img.setAttribute('href', dataUri)
    img.removeAttribute('xlink:href')
    img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href')
  }
}

/** Trigger a browser download of an SVG string. */
export function downloadSvgString(
  svgText: string,
  filename = 'runcloud9-canvas.svg',
): void {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

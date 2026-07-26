import { EXPORT_STRIP_QUERY } from './exportStrip'
import {
  readSvgViewBox,
  resolveExportViewBox,
  viewBoxAttr,
  type ExportFrame,
  type ExportViewBox,
} from './exportViewBox'
import {
  fetchAssetAsDataUri,
  type FetchBytes,
} from './inlineImages'

export type SerializeSvgSceneOptions = {
  /** Node tips used when frame is `content`, or as fallback. */
  nodes: readonly { x: number; y: number }[]
  /**
   * `viewport` (default) = live camera / full on-screen canvas.
   * `content` = crop around node tips.
   */
  frame?: ExportFrame
  /** Width / height aspect for content framing fallback. Default 16/9. */
  aspect?: number
  /** Pixel size written on the root SVG (defaults to host size or viewBox). */
  width?: number
  height?: number
  /** Host / page fill behind the floor diamond (matches canvas floor theme). */
  background?: string
  fetchBytes?: FetchBytes
}

/**
 * Clone a live design SVG into a standalone file string (grid/floor included).
 * Default framing matches the live camera so the download is the full canvas.
 */
export async function serializeSvgScene(
  source: SVGSVGElement,
  options: SerializeSvgSceneOptions,
): Promise<string> {
  const clone = source.cloneNode(true) as SVGSVGElement
  stripExportNoise(clone)

  const vb = resolveExportViewBox({
    frame: options.frame,
    liveViewBox: readSvgViewBox(source),
    nodes: options.nodes,
    aspect: options.aspect,
  })
  applyRootAttrs(clone, vb, options.width, options.height)
  ensureExportBackground(clone, vb, options.background)

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

/** Full-rect host fill so export matches the in-app canvas (not transparent corners). */
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

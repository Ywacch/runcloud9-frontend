/** SVG viewBox ↔ host-local screen bridge (Pixi counterpart: canvasViewportBridge). */

let svgEl: SVGSVGElement | null = null
let hostEl: HTMLElement | null = null
const listeners = new Set<() => void>()

export function registerSvgViewport(svg: SVGSVGElement, host: HTMLElement): void {
  unregisterSvgViewport()
  svgEl = svg
  hostEl = host
}

export function unregisterSvgViewport(): void {
  svgEl = null
  hostEl = null
}

/** Call after pan/zoom/resize so tooltip anchors re-project. */
export function notifySvgViewportScreenRefresh(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeSvgViewportScreenRefresh(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Subset of DOMMatrix / SVGMatrix used for world → screen. */
export type SvgCtm = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/** Pure helper — same math as svgWorldToHost without module state. */
export function projectSvgWorldToHost(
  ctm: SvgCtm,
  hostRect: { left: number; top: number },
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  const screenX = ctm.a * worldX + ctm.c * worldY + ctm.e
  const screenY = ctm.b * worldX + ctm.d * worldY + ctm.f
  return { x: screenX - hostRect.left, y: screenY - hostRect.top }
}

/**
 * SVG user/world units → coordinates relative to the registered host element
 * (same space as an absolutely positioned overlay inside the host).
 */
export function svgWorldToHost(
  worldX: number,
  worldY: number,
): { x: number; y: number } | null {
  if (!svgEl || !hostEl) return null
  const ctm = svgEl.getScreenCTM()
  if (!ctm) return null
  return projectSvgWorldToHost(ctm, hostEl.getBoundingClientRect(), worldX, worldY)
}

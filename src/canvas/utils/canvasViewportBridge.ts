import type { Viewport } from 'pixi-viewport'

let viewport: Viewport | null = null
const listeners = new Set<() => void>()
let onViewportChange: (() => void) | null = null

export function registerCanvasViewport(vp: Viewport): void {
  unregisterCanvasViewport()
  viewport = vp
  onViewportChange = () => listeners.forEach((listener) => listener())
  vp.on('moved', onViewportChange)
  vp.on('zoomed', onViewportChange)
}

export function unregisterCanvasViewport(): void {
  if (viewport && onViewportChange) {
    viewport.off('moved', onViewportChange)
    viewport.off('zoomed', onViewportChange)
  }
  viewport = null
  onViewportChange = null
}

export function subscribeCanvasViewportScreenRefresh(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Viewport-local coords (same space as ComponentContainer.position). */
export function viewportLocalToScreen(x: number, y: number): { x: number; y: number } | null {
  if (!viewport) return null
  const global = viewport.toGlobal({ x, y })
  return { x: global.x, y: global.y }
}

/**
 * Live drag offsets for SVG canvas — updates without re-rendering SvgDesignCanvas.
 * Components use useSyncExternalStore; getSnapshot returns a stable string so
 * non-dragged nodes bail out (Object.is) when notified.
 */
export type DragLiveSnapshot = {
  ids: string[]
  idSet: Set<string>
  origins: Record<string, { x: number; y: number }>
  dx: number
  dy: number
} | null

let snapshot: DragLiveSnapshot = null
let epoch = 0
const listeners = new Set<() => void>()

export function getDragLive(): DragLiveSnapshot {
  return snapshot
}

export function getDragLiveEpoch(): number {
  return epoch
}

export function setDragLive(
  next: {
    ids: string[]
    origins: Record<string, { x: number; y: number }>
    dx: number
    dy: number
  } | null,
): void {
  if (next == null) {
    if (snapshot == null) return
    snapshot = null
  } else {
    snapshot = {
      ids: next.ids,
      idSet: new Set(next.ids),
      origins: next.origins,
      dx: next.dx,
      dy: next.dy,
    }
  }
  epoch += 1
  for (const listener of listeners) listener()
}

export function subscribeDragLive(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

/** Snapshot key for one node — empty when not dragging that node. */
export function dragLiveKeyForNode(nodeId: string): string {
  const d = snapshot
  if (!d || !d.idSet.has(nodeId)) return ''
  const o = d.origins[nodeId]
  if (!o) return ''
  return `${o.x + d.dx},${o.y + d.dy}`
}

export function parseDragLiveKey(
  key: string,
): { x: number; y: number } | null {
  if (!key) return null
  const comma = key.indexOf(',')
  if (comma < 0) return null
  const x = Number(key.slice(0, comma))
  const y = Number(key.slice(comma + 1))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

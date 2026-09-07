import type { DragLiveSnapshot } from '../svg-canvas/store/dragLiveStore'

export type SessionLayoutOffset = { dx: number; dy: number }

let offsets: Record<string, SessionLayoutOffset> = {}
let epoch = 0
const listeners = new Set<() => void>()

export function getSessionLayoutOffsets(): Readonly<
  Record<string, SessionLayoutOffset>
> {
  return offsets
}

export function getSessionLayoutOffset(nodeId: string): SessionLayoutOffset {
  return offsets[nodeId] ?? { dx: 0, dy: 0 }
}

export function setSessionLayoutOffsets(
  updates: Array<{ id: string; dx: number; dy: number }>,
): void {
  if (updates.length === 0) return
  let changed = false
  const next = { ...offsets }
  for (const u of updates) {
    if (Math.abs(u.dx) < 1e-6 && Math.abs(u.dy) < 1e-6) {
      if (next[u.id]) {
        delete next[u.id]
        changed = true
      }
      continue
    }
    const prev = next[u.id]
    if (prev && prev.dx === u.dx && prev.dy === u.dy) continue
    next[u.id] = { dx: u.dx, dy: u.dy }
    changed = true
  }
  if (!changed) return
  offsets = next
  epoch += 1
  for (const listener of listeners) listener()
}

export function clearSessionLayout(): void {
  if (Object.keys(offsets).length === 0) return
  offsets = {}
  epoch += 1
  for (const listener of listeners) listener()
}

export function getSessionLayoutEpoch(): number {
  return epoch
}

export function subscribeSessionLayout(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

/** Stable snapshot key for useSyncExternalStore — empty when no offset. */
export function sessionLayoutKeyForNode(nodeId: string): string {
  const o = offsets[nodeId]
  if (!o || (o.dx === 0 && o.dy === 0)) return ''
  return `${o.dx},${o.dy}`
}

export function parseSessionLayoutKey(key: string): SessionLayoutOffset | null {
  if (!key) return null
  const comma = key.indexOf(',')
  if (comma < 0) return null
  const dx = Number(key.slice(0, comma))
  const dy = Number(key.slice(comma + 1))
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  return { dx, dy }
}

/** World position with session offset and optional in-flight drag overlay. */
export function displayWorldPosition(
  node: { id: string; x: number; y: number },
  drag: DragLiveSnapshot | null = null,
): { x: number; y: number } {
  const layout = getSessionLayoutOffset(node.id)
  if (drag?.idSet.has(node.id)) {
    const origin = drag.origins[node.id]
    if (origin) {
      return { x: origin.x + drag.dx, y: origin.y + drag.dy }
    }
  }
  return { x: node.x + layout.dx, y: node.y + layout.dy }
}

export function applySessionLayoutToNodes<
  T extends { id: string; x: number; y: number },
>(nodes: readonly T[]): T[] {
  if (Object.keys(offsets).length === 0) return [...nodes]
  return nodes.map((node) => {
    const layout = offsets[node.id]
    if (!layout || (layout.dx === 0 && layout.dy === 0)) return node
    return { ...node, x: node.x + layout.dx, y: node.y + layout.dy }
  })
}

import type { UnitOffset } from './composeAppServer'
import { HALF_H, HALF_W } from '../math/iso'

export function expandedSlotOffset(idx: number): { x: number; y: number } {
  if (idx === 0) return { x: 0, y: 0 }
  const step = Math.ceil(idx / 2)
  const dir = idx % 2 === 1 ? -1 : 1
  const spread = 1.3
  return {
    x: dir * step * spread * HALF_W,
    y: dir * step * spread * HALF_H,
  }
}

export function composeExpandedFanUnits(count: number): UnitOffset[] {
  const n = Math.max(1, Math.floor(count))
  return Array.from({ length: n }, (_, i) => {
    const off = expandedSlotOffset(i)
    return { dx: off.x, dy: off.y }
  })
}

import type { UnitOffset } from './composeAppServer'
import { HALF_H, HALF_W } from '../math/iso'
import { clampProjection } from '../math/projection'

function expandedSlotOffsetIso(idx: number): { x: number; y: number } {
  if (idx === 0) return { x: 0, y: 0 }
  const step = Math.ceil(idx / 2)
  const dir = idx % 2 === 1 ? -1 : 1
  const spread = 1.3
  return {
    x: dir * step * spread * HALF_W,
    y: dir * step * spread * HALF_H,
  }
}

function expandedSlotOffsetFlat(idx: number): { x: number; y: number } {
  if (idx === 0) return { x: 0, y: 0 }
  const step = Math.ceil(idx / 2)
  const dir = idx % 2 === 1 ? -1 : 1
  const spread = 1.3
  return { x: 0, y: dir * step * spread * HALF_H }
}

export function expandedSlotOffset(idx: number, projectionT = 0): { x: number; y: number } {
  const u = clampProjection(projectionT)
  if (u === 0) return expandedSlotOffsetIso(idx)
  if (u === 1) return expandedSlotOffsetFlat(idx)
  const iso = expandedSlotOffsetIso(idx)
  const flat = expandedSlotOffsetFlat(idx)
  return {
    x: iso.x + (flat.x - iso.x) * u,
    y: iso.y + (flat.y - iso.y) * u,
  }
}

export function composeExpandedFanUnits(count: number, projectionT = 0): UnitOffset[] {
  const n = Math.max(1, Math.floor(count))
  return Array.from({ length: n }, (_, i) => {
    const off = expandedSlotOffset(i, projectionT)
    return { dx: off.x, dy: off.y }
  })
}

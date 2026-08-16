import { describe, expect, it } from 'vitest'
import { composeExpandedFanUnits, expandedSlotOffset } from './expandedSlots'
import { HALF_H, HALF_W } from '../math/iso'

describe('expandedSlots', () => {
  it('first slot is origin', () => {
    expect(expandedSlotOffset(0)).toEqual({ x: 0, y: 0 })
  })

  it('alternates left/right with equal spread for paired indices', () => {
    const o1 = expandedSlotOffset(1)
    const o2 = expandedSlotOffset(2)
    expect(o1.x).toBeLessThan(0)
    expect(o2.x).toBeGreaterThan(0)
    expect(Math.abs(o2.x)).toBe(Math.abs(o1.x))
    expect(o1.y).toBeLessThan(0)
    expect(o2.y).toBeGreaterThan(0)
  })

  it('increases spread for higher indices', () => {
    const o1 = expandedSlotOffset(1)
    const o3 = expandedSlotOffset(3)
    expect(Math.abs(o3.x)).toBeGreaterThan(Math.abs(o1.x))
    expect(Math.abs(o3.y)).toBeGreaterThan(Math.abs(o1.y))
  })

  it('uses half-cell spacing scaled by spread factor', () => {
    const o1 = expandedSlotOffset(1)
    expect(o1.x).toBe(-1.3 * HALF_W)
    expect(o1.y).toBe(-1.3 * HALF_H)
  })

  it('composeExpandedFanUnits matches per-index offsets', () => {
    const units = composeExpandedFanUnits(3)
    expect(units).toHaveLength(3)
    expect(units[0]).toEqual({ dx: 0, dy: 0 })
    const off1 = expandedSlotOffset(1)
    const off2 = expandedSlotOffset(2)
    expect(units[1]).toEqual({ dx: off1.x, dy: off1.y })
    expect(units[2]).toEqual({ dx: off2.x, dy: off2.y })
  })

  it('clamps count to at least one', () => {
    expect(composeExpandedFanUnits(0)).toHaveLength(1)
    expect(composeExpandedFanUnits(-2)).toHaveLength(1)
  })
})

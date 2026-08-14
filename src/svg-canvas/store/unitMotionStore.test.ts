import { describe, expect, it } from 'vitest'
import { easeOutCubic, planUnitTransition } from '../store/unitMotionStore'

describe('unitMotionStore helpers', () => {
  it('easeOutCubic ends at 1', () => {
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0)).toBe(0)
  })

  it('planUnitTransition count up spawns at primary', () => {
    const { units, anims } = planUnitTransition(
      [{ id: 'u0', dx: 0, dy: 0, opacity: 1, scale: 1 }],
      [{ dx: 0, dy: 0 }, { dx: 10, dy: 5 }],
      { dx: 0, dy: 0 },
      0,
    )
    expect(units.length).toBe(2)
    expect(anims.length).toBe(2)
    expect(units[1].opacity).toBe(0)
  })
})

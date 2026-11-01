import { describe, expect, it } from 'vitest'
import { easeInOutCubic, easeOutCubic, planUnitTransition } from '../store/unitMotionStore'

describe('unitMotionStore helpers', () => {
  it('easeOutCubic ends at 1', () => {
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0)).toBe(0)
  })

  it('easeInOutCubic is flat at both ends', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBe(0.5)
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

  it('planUnitTransition shrink keeps stable layer ids on promote', () => {
    const current = [
      { id: 'postgres', dx: 0, dy: 0, opacity: 1, scale: 1 },
      { id: 'postgres-replica-0', dx: 10, dy: 0, opacity: 1, scale: 1 },
      { id: 'postgres-replica-1', dx: 20, dy: 0, opacity: 1, scale: 1 },
    ]
    const target = [{ dx: 0, dy: 0 }, { dx: 10, dy: 0 }]
    const targetIds = ['postgres', 'postgres-replica-1']
    const { units, anims } = planUnitTransition(current, target, { dx: 0, dy: 0 }, 0, {
      targetIds,
    })
    const removed = anims.find((a) => a.id === 'postgres-replica-0')
    const kept = anims.find((a) => a.id === 'postgres-replica-1')
    expect(removed?.removeAtEnd).toBe(true)
    expect(units.find((u) => u.id === 'postgres-replica-0')?.leaving).toBe(true)
    expect(kept?.removeAtEnd).not.toBe(true)
  })

  it('planUnitTransition can snap new units without spawn fade', () => {
    const { units, anims } = planUnitTransition(
      [{ id: 'u0', dx: 0, dy: 0, opacity: 1, scale: 1 }],
      [{ dx: 0, dy: 0 }, { dx: 10, dy: 5 }],
      { dx: 0, dy: 0 },
      0,
      { animateSpawn: false },
    )
    expect(units.length).toBe(2)
    expect(units[1].opacity).toBe(1)
    expect(units[1].scale).toBe(1)
    expect(anims.some((a) => a.id === 'u1')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CC_HALF_H,
  CC_REDIS_SIDE_H,
  CC_REDIS_STACK_STEP,
  composeRedisBrandSlabs,
} from './cloudcraftRedisBrand'

describe('cloudcraftRedisBrand (measured from export SVG)', () => {
  it('uses thin slabs with step = 1.5 × side height', () => {
    expect(CC_REDIS_SIDE_H).toBeCloseTo(CC_HALF_H / 2, 2)
    expect(CC_REDIS_STACK_STEP).toBeCloseTo(1.5 * CC_REDIS_SIDE_H, 1)
  })

  it('stacks three slabs on pure screen-Y', () => {
    const s = composeRedisBrandSlabs()
    expect(s).toHaveLength(3)
    expect(s.every((p) => p.dx === 0)).toBe(true)
    expect(s[1].dy - s[0].dy).toBeCloseTo(-CC_REDIS_STACK_STEP, 5)
  })
})

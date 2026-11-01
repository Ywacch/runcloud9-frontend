import { describe, expect, it } from 'vitest'
import {
  APP_SERVER_SIDE_H,
  APP_SERVER_STACK_STEP,
  composeAppServerUnits,
} from './composeAppServer'

describe('composeAppServerUnits', () => {
  it('returns single origin for one replica', () => {
    expect(composeAppServerUnits(1)).toEqual([{ dx: 0, dy: 0 }])
  })

  it('stacks whole units on pure screen-Y (no diagonal drift)', () => {
    const u = composeAppServerUnits(3)
    expect(u).toHaveLength(3)
    expect(u[0]).toEqual({ dx: 0, dy: 0 })
    expect(u[1]).toEqual({ dx: 0, dy: -APP_SERVER_STACK_STEP })
    expect(u[2]).toEqual({ dx: 0, dy: -2 * APP_SERVER_STACK_STEP })
  })

  it('keeps stack step below body height (shelf peek, not floating gap)', () => {
    expect(APP_SERVER_STACK_STEP).toBeLessThan(APP_SERVER_SIDE_H)
  })

  it('clamps to platform max (5)', () => {
    expect(composeAppServerUnits(0)).toHaveLength(1)
    expect(composeAppServerUnits(9)).toHaveLength(5)
  })
})

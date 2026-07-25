import { describe, expect, it } from 'vitest'
import { lerpUnitOffsetsForTest } from './useUnitOffsetsTween'

describe('lerpUnitOffsetsForTest', () => {
  it('lerps mid-frame between equal-length offsets', () => {
    const from = [{ dx: 0, dy: 0 }]
    const to = [{ dx: 10, dy: 20 }]
    expect(lerpUnitOffsetsForTest(from, to, 0.5)).toEqual([{ dx: 5, dy: 10 }])
  })

  it('snaps to target when unit count changes', () => {
    const from = [{ dx: 0, dy: 0 }]
    const to = [
      { dx: 0, dy: 0 },
      { dx: 8, dy: 4 },
    ]
    expect(lerpUnitOffsetsForTest(from, to, 0.5)).toEqual(to)
  })
})

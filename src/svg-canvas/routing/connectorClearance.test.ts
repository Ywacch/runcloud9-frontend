import { describe, expect, it } from 'vitest'
import { isoToScreen } from '../math/iso'
import { pathsCross, segmentsCross } from './connectorClearance'

describe('connectorClearance', () => {
  it('detects crossing segments and ignores shared endpoints', () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ),
    ).toBe(true)
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ),
    ).toBe(false)
  })

  it('detects polyline crossings', () => {
    expect(
      pathsCross(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        [
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ],
      ),
    ).toBe(true)
    expect(
      pathsCross(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 0, y: 10 },
          { x: 10, y: 10 },
        ],
      ),
    ).toBe(false)
    void isoToScreen
  })
})

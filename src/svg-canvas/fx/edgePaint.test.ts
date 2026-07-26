import { describe, expect, it } from 'vitest'
import {
  EDGE_ARROW_LENGTH,
  clearanceForArchetype,
  approachTip,
  arrowPolygon,
  insetAlong,
  junctionPoints,
  paintedSegmentEnds,
} from './edgePaint'

describe('edgePaint', () => {
  it('builds a triangle tip at the end point', () => {
    const pts = arrowPolygon(0, 0, 100, 0)
    expect(pts.startsWith('100,0 ')).toBe(true)
    expect(pts).toContain(`${100 - EDGE_ARROW_LENGTH}`)
  })

  it('insets along the segment without overshooting', () => {
    expect(insetAlong({ x: 0, y: 0 }, { x: 100, y: 0 }, 18)).toEqual({
      x: 18,
      y: 0,
    })
    expect(insetAlong({ x: 0, y: 0 }, { x: 10, y: 0 }, 18)).toEqual({
      x: 4.5,
      y: 0,
    })
  })

  it('gives database more clearance than a generic node', () => {
    expect(clearanceForArchetype('database')).toBeGreaterThan(
      clearanceForArchetype('app-server'),
    )
    const tip = approachTip(
      { x: 200, y: 0 },
      { x: 0, y: 0 },
      clearanceForArchetype('database'),
    )
    expect(tip.x).toBeLessThan(200 - 80)
  })

  it('pulls painted ends back for clearance + arrow base', () => {
    const { a, b } = paintedSegmentEnds(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      {
        insetStart: false,
        insetEnd: true,
        nodeClearanceEnd: true,
        arrowInset: 18,
        clearanceEnd: 34,
      },
    )
    expect(a).toEqual({ x: 0, y: 0 })
    expect(b).toEqual({ x: 148, y: 0 })
  })

  it('returns only interior elbows as junction points', () => {
    expect(
      junctionPoints([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ]),
    ).toEqual([{ x: 10, y: 10 }])
    expect(junctionPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([])
  })
})

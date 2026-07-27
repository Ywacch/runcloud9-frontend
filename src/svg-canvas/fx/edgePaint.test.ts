import { describe, expect, it } from 'vitest'
import {
  EDGE_ARROW_HALF_W,
  EDGE_ARROW_LENGTH,
  EDGE_ARROW_NOTCH,
  EDGE_ARROW_SHAFT_INSET,
  EDGE_STROKE_WIDTH,
  clearanceForArchetype,
  arrowCloudcraftPolygon,
  extendBehind,
  insetAlong,
  junctionPoints,
  paintedSegmentEnds,
  terminalArrowGeometry,
} from './edgePaint'
import { resolveEdgePaint } from './edgePresets'
import { defaultEdgeStyle } from '../store/svgTypes'

describe('edgePaint', () => {
  it('builds a Cloudcraft chevron tip (tip, left wing, notch, right wing)', () => {
    const pts = arrowCloudcraftPolygon(0, 0, EDGE_ARROW_NOTCH, 0)
    const parts = pts.split(' ').map((p) => p.split(',').map(Number))
    expect(parts).toHaveLength(4)
    expect(parts[0][0]).toBeCloseTo(EDGE_ARROW_NOTCH)
    expect(parts[0][1]).toBeCloseTo(0)
    expect(parts[2][0]).toBeCloseTo(0)
    expect(parts[2][1]).toBeCloseTo(0)
    // Symmetric wings behind tip
    expect(parts[1][0]).toBeCloseTo(EDGE_ARROW_NOTCH - EDGE_ARROW_LENGTH)
    expect(parts[3][0]).toBeCloseTo(EDGE_ARROW_NOTCH - EDGE_ARROW_LENGTH)
    expect(Math.abs(parts[1][1])).toBeCloseTo(EDGE_ARROW_HALF_W)
    expect(Math.abs(parts[3][1])).toBeCloseTo(EDGE_ARROW_HALF_W)
    expect(parts[1][1]).toBeCloseTo(-parts[3][1])
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

  it('keeps tip clearance small — attach ports own glyph stand-off', () => {
    expect(clearanceForArchetype('database')).toBeGreaterThan(
      clearanceForArchetype('app-server'),
    )
    expect(clearanceForArchetype('database')).toBeLessThan(20)
  })

  it('places tip on the stub ray at the glyph rim', () => {
    const face = { x: 200, y: 0 }
    const from = { x: 0, y: 0 }
    const attach = { x: 180, y: 0 }
    const arrow = terminalArrowGeometry(
      attach,
      from,
      clearanceForArchetype('database'),
      EDGE_ARROW_SHAFT_INSET,
      { face, rimRadius: 70 },
    )
    expect(arrow.tip.x).toBeCloseTo(130)
    expect(arrow.tip.y).toBeCloseTo(0)
    expect(arrow.base.x).toBeCloseTo(arrow.tip.x - EDGE_ARROW_SHAFT_INSET)
    expect(arrow.base.y).toBeCloseTo(0)
  })

  it('tucks tip on the rim even when attach sits outside', () => {
    const face = { x: 200, y: 0 }
    const from = { x: 0, y: 0 }
    const attach = { x: 120, y: 0 }
    const arrow = terminalArrowGeometry(
      attach,
      from,
      4,
      EDGE_ARROW_SHAFT_INSET,
      { face, rimRadius: 70 },
    )
    expect(arrow.tip.x).toBeCloseTo(130)
    expect(arrow.base.x).toBeLessThan(arrow.tip.x)
  })

  it('shortens the head before burying the tip on a short stub', () => {
    const arrow = terminalArrowGeometry(
      { x: 20, y: 0 },
      { x: 0, y: 0 },
      clearanceForArchetype('database'),
    )
    expect(arrow.tip.x).toBeGreaterThanOrEqual(0)
    expect(arrow.tip.x).toBeLessThanOrEqual(20)
    expect(arrow.base.x).toBeLessThanOrEqual(arrow.tip.x)
  })

  it('does not invent a source gap when clearance is off', () => {
    const { a, b } = paintedSegmentEnds(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      {
        insetStart: false,
        insetEnd: false,
        nodeClearanceStart: false,
        nodeClearanceEnd: false,
      },
    )
    expect(a).toEqual({ x: 0, y: 0 })
    expect(b).toEqual({ x: 200, y: 0 })
  })

  it('extends a source stub behind the attach port', () => {
    expect(extendBehind({ x: 50, y: 0 }, { x: 100, y: 0 }, 20)).toEqual({
      x: 30,
      y: 0,
    })
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

  it('exports Cloudcraft shaft + chevron proportions', () => {
    expect(EDGE_ARROW_LENGTH).toBe(16)
    expect(EDGE_ARROW_NOTCH).toBe(11)
    expect(EDGE_ARROW_SHAFT_INSET).toBe(11)
    expect(EDGE_STROKE_WIDTH).toBe(2)
  })
})

describe('resolveEdgePaint stroke weight', () => {
  it('floors flow and schematic strokes at Cloudcraft shaft weight', () => {
    expect(resolveEdgePaint(defaultEdgeStyle(), 'flow', 'dark').width).toBe(
      EDGE_STROKE_WIDTH,
    )
    expect(
      resolveEdgePaint(defaultEdgeStyle(), 'schematic', 'dark').width,
    ).toBe(EDGE_STROKE_WIDTH)
  })
})

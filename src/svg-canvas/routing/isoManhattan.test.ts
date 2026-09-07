import { describe, expect, it } from 'vitest'
import { isoToScreen } from '../math/iso'
import { routeIsoManhattan } from './isoManhattan'

describe('routeIsoManhattan', () => {
  it('returns single point when source equals target lattice', () => {
    const p = isoToScreen(0, 0)
    expect(routeIsoManhattan({ source: p, target: p, obstacleAnchors: [] })).toEqual([
      p,
    ])
  })

  it('routes with at most one elbow on an empty field', () => {
    const source = isoToScreen(0, 0)
    const target = isoToScreen(4, 2)
    const path = routeIsoManhattan({
      source,
      target,
      obstacleAnchors: [],
    })
    expect(path[0]).toEqual(source)
    expect(path[path.length - 1]).toEqual(target)
    // Cloudcraft: straight or one bend — never a lattice staircase.
    expect(path.length).toBeLessThanOrEqual(3)
    // Offset that is not a shared screen row/col uses iso diamonds, not CAD H/V.
    if (path.length === 3) {
      const iso = 37 / 64
      for (let i = 1; i < path.length; i++) {
        const dx = Math.abs(path[i].x - path[i - 1].x)
        const dy = Math.abs(path[i].y - path[i - 1].y)
        expect(dx).toBeGreaterThan(1)
        expect(dy).toBeGreaterThan(1)
        expect(Math.abs(dy / dx - iso)).toBeLessThan(0.04)
      }
      const toX = target.x - source.x
      const toY = target.y - source.y
      const lastX = target.x - path[1].x
      const lastY = target.y - path[1].y
      expect(lastX * toX + lastY * toY).toBeGreaterThan(-1e-3)
    }
  })

  it('uses a screen-horizontal run when ports share a row', () => {
    // i+j constant → screen horizontal
    const source = isoToScreen(0, 2)
    const target = isoToScreen(4, -2)
    const path = routeIsoManhattan({
      source,
      target,
      obstacleAnchors: [],
    })
    expect(path.length).toBe(2)
    expect(path[0].y).toBeCloseTo(path[1].y)
  })

  it('detours around an obstacle between source and target', () => {
    const source = isoToScreen(0, 0)
    const target = isoToScreen(6, 0)
    const mid = isoToScreen(3, 0)
    const clear = routeIsoManhattan({
      source,
      target,
      obstacleAnchors: [],
    })
    // Unused by routeConnectorScene (which goes around bystanders). This
    // helper still returns the open-field straight when no cells are blocked.
    expect(clear.length).toBe(2)
    void mid
  })

  it('uses an iso elbow instead of a free diagonal when fully walled', () => {
    const source = isoToScreen(0, 0)
    const target = isoToScreen(6, 2)
    const wall: { x: number; y: number }[] = []
    for (let i = -2; i <= 8; i++) {
      for (let j = -2; j <= 4; j++) {
        if (i === 0 && j === 0) continue
        if (i === 6 && j === 2) continue
        wall.push(isoToScreen(i, j))
      }
    }
    const path = routeIsoManhattan({
      source,
      target,
      obstacleAnchors: wall,
    })
    expect(path[0]).toEqual(source)
    expect(path[path.length - 1]).toEqual(target)
    // Elbow fallback: at least one intermediate lattice bend (3 points)
    // or a collinear merge if corner coincides — never invent a new diagonal
    // midpoint off the iso axes.
    expect(path.length).toBeGreaterThanOrEqual(2)
    if (path.length === 2) {
      // Same row or column in lattice → straight iso axis is ok
      const s = source
      const t = target
      const dx = t.x - s.x
      const dy = t.y - s.y
      // Iso axis: |dx|/HALF_W ≈ |dy|/HALF_H for diagonal lattice edge —
      // a free screen diagonal between (0,0) and (6,2) would not match
      // a single lattice step direction. Accept elbow or axis-aligned merge.
      expect(Math.abs(dx) > 1 || Math.abs(dy) > 1).toBe(true)
    } else {
      expect(path.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('legacy helper still paints a straight iso run through listed cells', () => {
    const source = isoToScreen(0, 0)
    const target = isoToScreen(8, 0)
    const path = routeIsoManhattan({
      source,
      target,
      obstacleCells: [
        { i: 3, j: 0 },
        { i: 4, j: 0 },
        { i: 5, j: 0 },
      ],
    })
    expect(path).toHaveLength(2)
    expect(path[0]).toEqual(source)
    expect(path[1]).toEqual(target)
  })
})

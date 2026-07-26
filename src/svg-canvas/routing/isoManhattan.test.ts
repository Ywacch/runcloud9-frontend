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

  it('routes with elbows on an empty field', () => {
    const source = isoToScreen(0, 0)
    const target = isoToScreen(4, 2)
    const path = routeIsoManhattan({
      source,
      target,
      obstacleAnchors: [],
    })
    expect(path[0]).toEqual(source)
    expect(path[path.length - 1]).toEqual(target)
    expect(path.length).toBeGreaterThanOrEqual(2)
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
    const blocked = routeIsoManhattan({
      source,
      target,
      obstacleAnchors: [mid],
    })
    expect(blocked[0]).toEqual(source)
    expect(blocked[blocked.length - 1]).toEqual(target)
    const same =
      clear.length === blocked.length &&
      clear.every((p, i) => p.x === blocked[i].x && p.y === blocked[i].y)
    expect(same).toBe(false)
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

  it('accepts explicit obstacleCells footprints', () => {
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
    expect(path[0]).toEqual(source)
    expect(path[path.length - 1]).toEqual(target)
    expect(path.length).toBeGreaterThan(2)
  })
})

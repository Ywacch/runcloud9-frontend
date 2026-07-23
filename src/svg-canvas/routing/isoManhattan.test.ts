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
    // Detour should not be the same as the clear path, or should have more points
    const clearLen = clear.length
    const blockedLen = blocked.length
    const same =
      clearLen === blockedLen &&
      clear.every((p, i) => p.x === blocked[i].x && p.y === blocked[i].y)
    expect(same).toBe(false)
  })

  it('falls back to endpoints when path is fully walled off', () => {
    const source = isoToScreen(0, 0)
    const target = isoToScreen(6, 0)
    const wall: { x: number; y: number }[] = []
    for (let i = -2; i <= 8; i++) {
      for (let j = -2; j <= 2; j++) {
        if (i === 0 && j === 0) continue
        if (i === 6 && j === 0) continue
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
  })
})

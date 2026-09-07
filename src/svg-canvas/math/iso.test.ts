import { describe, expect, it } from 'vitest'
import {
  BOUNDED_COLS,
  BOUNDED_ORIGIN_I,
  BOUNDED_ORIGIN_J,
  BOUNDED_ROWS,
  boundedPlacementIsoBounds,
  CELL_H,
  CELL_W,
  HALF_H,
  HALF_W,
  isoToScreen,
  pathInBoundedSlab,
  pointInBoundedSlab,
  screenToIso,
  snapWorld,
  SNAP_H,
  SNAP_W,
} from './iso'

describe('svg-canvas iso math', () => {
  it('uses Cloudcraft cell sizes and quarter-cell fine snap', () => {
    expect(CELL_W).toBe(128)
    expect(CELL_H).toBe(74)
    expect(HALF_W).toBe(64)
    expect(HALF_H).toBe(37)
    expect(SNAP_W).toBe(32)
    expect(SNAP_H).toBe(18.5)
    expect(SNAP_W * 2).toBe(HALF_W)
    expect(SNAP_H * 2).toBe(HALF_H)
    expect(SNAP_W * 4).toBe(CELL_W)
    expect(SNAP_H * 4).toBe(CELL_H)
  })

  it('round-trips integer lattice points', () => {
    for (const [i, j] of [
      [0, 0],
      [2, 3],
      [4, 3],
      [6, 3],
      [-1, 2],
    ] as const) {
      const { x, y } = isoToScreen(i, j)
      const back = screenToIso(x, y)
      expect(back.i).toBeCloseTo(i, 10)
      expect(back.j).toBeCloseTo(j, 10)
    }
  })

  it('matches research neighbor step T2→G2 (one major cell)', () => {
    const t2 = isoToScreen(2, 3)
    const g2 = isoToScreen(4, 3)
    expect(g2.x - t2.x).toBe(128)
    expect(g2.y - t2.y).toBe(74)
  })

  it('takes 4 fine snaps to cross one major cell along x', () => {
    expect(snapWorld(0, 0)).toEqual({ x: 0, y: 0 })
    expect(snapWorld(16, 0)).toEqual({ x: 32, y: 0 })
    expect(snapWorld(40, 0)).toEqual({ x: 32, y: 0 })
    expect(snapWorld(50, 0)).toEqual({ x: 64, y: 0 })
    let x = 0
    for (let step = 0; step < 4; step++) {
      x = snapWorld(x + SNAP_W, 0).x
    }
    expect(x).toBe(CELL_W)
  })

  it('takes 2 fine snaps to cross one inner box along x', () => {
    let x = 0
    for (let step = 0; step < 2; step++) {
      x = snapWorld(x + SNAP_W, 0).x
    }
    expect(x).toBe(HALF_W)
  })

  it('half-integer lattice points sit on major diamond vertices', () => {
    // Pattern major: M64 0 L128 37 64 74 0 37 — top / right verts
    expect(isoToScreen(0.5, -0.5)).toEqual({ x: 64, y: 0 })
    expect(isoToScreen(1.5, -0.5)).toEqual({ x: 128, y: 37 })
  })

  it('classifies points inside the bounded floor slab', () => {
    expect(BOUNDED_COLS).toBe(10)
    expect(BOUNDED_ROWS).toBe(18)
    const center = isoToScreen(0, 0)
    expect(pointInBoundedSlab(center)).toBe(true)
    const far = isoToScreen(BOUNDED_ORIGIN_I - 6, BOUNDED_ORIGIN_J)
    expect(pointInBoundedSlab(far)).toBe(false)
    expect(
      pathInBoundedSlab([center, isoToScreen(2, 2)]),
    ).toBe(true)
    const bounds = boundedPlacementIsoBounds()
    expect(bounds.minCol).toBe(-3)
    expect(bounds.maxCol).toBe(4)
    expect(bounds.minRow).toBe(-7)
    expect(bounds.maxRow).toBe(8)
  })
})

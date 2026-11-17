import { describe, expect, it } from 'vitest'
import { isoToScreen, screenToIso } from './iso'
import {
  latticeFromScreen,
  modelWorld,
  presentWorld,
  projectLattice,
} from './projection'

describe('projectLattice', () => {
  it('matches isoToScreen at t = 0', () => {
    for (const [i, j] of [
      [0, 0],
      [2, 0],
      [0, 3],
      [-1.5, 2.5],
    ] as const) {
      expect(projectLattice(i, j, 0)).toEqual(isoToScreen(i, j))
    }
  })

  it('draws a square lattice at t = 1', () => {
    expect(projectLattice(2, -1, 1)).toEqual({ x: 64, y: 128 })
    expect(projectLattice(0, 3, 1)).toEqual({ x: -192, y: 0 })
  })

  it('reads dependency layers left to right', () => {
    const upstream = projectLattice(0, 0, 1)
    const downstream = projectLattice(0, -2, 1)
    const sibling = projectLattice(2, 0, 1)
    expect(downstream.x).toBeGreaterThan(upstream.x)
    expect(downstream.y).toBe(upstream.y)
    expect(sibling.x).toBe(upstream.x)
    expect(sibling.y).not.toBe(upstream.y)
  })

  it('round-trips through the inverse at mid blend', () => {
    for (const t of [0, 0.35, 1]) {
      for (const [i, j] of [
        [0, 0],
        [4, -2],
        [-3, 1.5],
      ] as const) {
        const screen = projectLattice(i, j, t)
        const back = latticeFromScreen(screen.x, screen.y, t)
        expect(back.i).toBeCloseTo(i, 8)
        expect(back.j).toBeCloseTo(j, 8)
      }
    }
  })

  it('keeps iso world stable through present and model', () => {
    const iso = isoToScreen(3, -2)
    expect(presentWorld(iso, 0)).toBe(iso)
    expect(modelWorld(iso, 0)).toBe(iso)
    const shown = presentWorld(iso, 0.6)
    const back = modelWorld(shown, 0.6)
    expect(back.x).toBeCloseTo(iso.x, 6)
    expect(back.y).toBeCloseTo(iso.y, 6)
    expect(screenToIso(back.x, back.y).i).toBeCloseTo(3, 6)
    expect(screenToIso(back.x, back.y).j).toBeCloseTo(-2, 6)
  })
})

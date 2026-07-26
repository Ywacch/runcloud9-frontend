import { describe, expect, it } from 'vitest'
import { HALF_H, HALF_W, isoToScreen } from '../math/iso'
import { attachPair, attachPoint, faceCenter } from './attach'

describe('attach', () => {
  const node = { x: 0, y: 0 }

  it('defaults to the top-face center', () => {
    expect(attachPoint(node)).toEqual(faceCenter(node))
    expect(faceCenter(node)).toEqual({ x: HALF_W, y: 0 })
  })

  it('shifts the port toward the peer on the face rim', () => {
    const toward = { x: 400, y: 0 }
    const port = attachPoint(node, toward)
    expect(port.x).toBeGreaterThan(faceCenter(node).x)
    expect(port.y).toBe(0)
    expect(port.x).toBeCloseTo(HALF_W + HALF_W * 0.55, 5)
  })

  it('builds a mutual attach pair facing each other', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 4 * HALF_W, y: 2 * HALF_H }
    const pair = attachPair(a, b)
    const ac = faceCenter(a)
    const bc = faceCenter(b)
    // Source port should move toward B; target toward A.
    expect(pair.source.x).toBeGreaterThan(ac.x)
    expect(pair.target.x).toBeLessThan(bc.x)
  })

  it('keeps ports on lattice-friendly positions for iso neighbors', () => {
    const a = { x: isoToScreen(0, 0).x - HALF_W, y: isoToScreen(0, 0).y }
    const b = { x: isoToScreen(4, 0).x - HALF_W, y: isoToScreen(4, 0).y }
    const pair = attachPair(a, b)
    expect(pair.source).not.toEqual(faceCenter(a))
    expect(pair.target).not.toEqual(faceCenter(b))
  })
})

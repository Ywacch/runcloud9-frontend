import { describe, expect, it } from 'vitest'
import { HALF_H, HALF_W, isoToScreen } from '../math/iso'
import { attachPair, attachPoint, faceCenter } from './attach'

describe('attach', () => {
  const node = { x: 0, y: 0, archetype: 'app-server' as const }

  it('defaults to the top-face center', () => {
    expect(attachPoint(node)).toEqual(faceCenter(node))
    // App-server seat is sprite faceLogo, not the generic HALF_W diamond.
    expect(faceCenter(node).x).toBeCloseTo(56)
    expect(faceCenter(node).y).toBeCloseTo(0)
  })

  it('shifts the port toward the peer outside the face rim', () => {
    const toward = { x: 400, y: 0 }
    const port = attachPoint(node, toward)
    // App outset stays near the half-face rim.
    expect(port.x).toBeGreaterThan(faceCenter(node).x + HALF_W * 0.5)
    expect(port.y).toBe(0)
  })

  it('pushes database ports just outside the cylinder body', () => {
    const db = { x: 0, y: 0, archetype: 'database' as const }
    const toward = { x: 400, y: 0 }
    const dbPort = attachPoint(db, toward, { archetype: 'database' })
    const face = faceCenter(db, 'database')
    const dist = Math.hypot(dbPort.x - face.x, dbPort.y - face.y)
    // Outside the painted drum (~64 rim) but not floating far away.
    expect(dist).toBeGreaterThan(68)
    expect(dist).toBeLessThan(85)
  })

  it('shares one approach port for multi-edge slots toward the same peer', () => {
    const toward = { x: 0, y: 400 }
    const a = attachPoint(node, toward, { slot: 0, slotCount: 2 })
    const b = attachPoint(node, toward, { slot: 1, slotCount: 2 })
    expect(a.x).toBeCloseTo(b.x, 5)
    expect(a.y).toBeCloseTo(b.y, 5)
  })

  it('uses a wider port ring for message-queue', () => {
    const mq = { x: 0, y: 0, archetype: 'message-queue' as const }
    const toward = { x: 400, y: 0 }
    const mqPort = attachPoint(mq, toward, { archetype: 'message-queue' })
    const face = faceCenter(mq, 'message-queue')
    const dist = Math.hypot(mqPort.x - face.x, mqPort.y - face.y)
    expect(dist).toBeGreaterThan(HALF_W * 0.7)
  })

  it('builds a mutual attach pair facing each other', () => {
    const a = { x: 0, y: 0, archetype: 'app-server' as const }
    const b = {
      x: 4 * HALF_W,
      y: 2 * HALF_H,
      archetype: 'database' as const,
    }
    const pair = attachPair(a, b)
    const ac = faceCenter(a)
    const bc = faceCenter(b)
    expect(pair.source.x).toBeGreaterThan(ac.x)
    expect(pair.target.x).toBeLessThan(bc.x)
  })

  it('keeps ports away from face centers for iso neighbors', () => {
    const a = {
      x: isoToScreen(0, 0).x - HALF_W,
      y: isoToScreen(0, 0).y,
      archetype: 'app-server' as const,
    }
    const b = {
      x: isoToScreen(4, 0).x - HALF_W,
      y: isoToScreen(4, 0).y,
      archetype: 'database' as const,
    }
    const pair = attachPair(a, b)
    expect(pair.source).not.toEqual(faceCenter(a))
    expect(pair.target).not.toEqual(faceCenter(b))
  })
})

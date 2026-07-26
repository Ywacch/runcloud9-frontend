import { describe, expect, it } from 'vitest'
import { HALF_H, HALF_W, isoToScreen } from '../math/iso'
import { attachPair, attachPoint, faceCenter } from './attach'

describe('attach', () => {
  const node = { x: 0, y: 0, archetype: 'app-server' as const }

  it('defaults to the top-face center', () => {
    expect(attachPoint(node)).toEqual(faceCenter(node))
    expect(faceCenter(node)).toEqual({ x: HALF_W, y: 0 })
  })

  it('shifts the port toward the peer outside the face rim', () => {
    const toward = { x: 400, y: 0 }
    const port = attachPoint(node, toward)
    expect(port.x).toBeGreaterThan(faceCenter(node).x + HALF_W * 0.55)
    expect(port.y).toBe(0)
  })

  it('fans sibling slots so multi-edge nodes do not share one approach', () => {
    const toward = { x: 0, y: 400 }
    const a = attachPoint(node, toward, { slot: 0, slotCount: 2 })
    const b = attachPoint(node, toward, { slot: 1, slotCount: 2 })
    expect(a.x).not.toBeCloseTo(b.x, 5)
  })

  it('uses a wider port ring for message-queue', () => {
    const mq = { x: 0, y: 0, archetype: 'message-queue' as const }
    const toward = { x: 400, y: 0 }
    const appPort = attachPoint(node, toward)
    const mqPort = attachPoint(mq, toward, { archetype: 'message-queue' })
    expect(mqPort.x).toBeGreaterThan(appPort.x)
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

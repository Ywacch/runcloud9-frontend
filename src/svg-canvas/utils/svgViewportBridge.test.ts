import { describe, expect, it } from 'vitest'
import { projectSvgWorldToHost } from './svgViewportBridge'

describe('projectSvgWorldToHost', () => {
  it('maps identity CTM into host-local coords', () => {
    const ctm = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    const host = { left: 100, top: 50 }
    expect(projectSvgWorldToHost(ctm, host, 20, 30)).toEqual({ x: -80, y: -20 })
  })

  it('applies scale and translation from the CTM', () => {
    // screenX = 2*x + 40, screenY = 2*y + 10
    const ctm = { a: 2, b: 0, c: 0, d: 2, e: 40, f: 10 }
    const host = { left: 0, top: 0 }
    expect(projectSvgWorldToHost(ctm, host, 10, 5)).toEqual({ x: 60, y: 20 })
  })
})

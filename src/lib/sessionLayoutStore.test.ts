import { beforeEach, describe, expect, it } from 'vitest'
import {
  applySessionLayoutToNodes,
  clearSessionLayout,
  displayWorldPosition,
  getSessionLayoutOffset,
  setSessionLayoutOffsets,
} from './sessionLayoutStore'

describe('sessionLayoutStore', () => {
  beforeEach(() => {
    clearSessionLayout()
  })

  it('stores offsets without touching canonical node positions', () => {
    setSessionLayoutOffsets([{ id: 'a', dx: 64, dy: 37 }])
    expect(getSessionLayoutOffset('a')).toEqual({ dx: 64, dy: 37 })
    const node = { id: 'a', x: 128, y: 74 }
    expect(displayWorldPosition(node)).toEqual({ x: 192, y: 111 })
    expect(node.x).toBe(128)
  })

  it('clears offsets on template reload hooks', () => {
    setSessionLayoutOffsets([{ id: 'a', dx: 10, dy: 5 }])
    clearSessionLayout()
    expect(getSessionLayoutOffset('a')).toEqual({ dx: 0, dy: 0 })
  })

  it('projects offsets onto svg nodes for edge reroute', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 128, y: 74 },
    ]
    setSessionLayoutOffsets([{ id: 'a', dx: 64, dy: 0 }])
    const placed = applySessionLayoutToNodes(nodes)
    expect(placed[0]).toEqual({ id: 'a', x: 64, y: 0 })
    expect(placed[1]).toEqual(nodes[1])
  })
})

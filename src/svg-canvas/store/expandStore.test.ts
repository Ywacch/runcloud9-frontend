import { describe, expect, it, beforeEach } from 'vitest'
import type { SvgNode } from './svgTypes'
import {
  getExpanded,
  resetExpandStoreForTests,
  setExpanded,
  syncExpandWithSelection,
} from './expandStore'

function stackNode(id: string, replicas = 3): SvgNode {
  return {
    id,
    archetype: 'app-server',
    engine: 'generic',
    x: 0,
    y: 0,
    label: 'App',
    topology: { replicas, packing: 'stack', shards: 1 },
    config: {},
  }
}

describe('syncExpandWithSelection', () => {
  beforeEach(() => {
    resetExpandStoreForTests()
  })

  it('expands stack replicas when a single node is selected', () => {
    const node = stackNode('a')
    syncExpandWithSelection(['a'], [node])
    expect(getExpanded('a')).toBe(true)
  })

  it('collapses when selection clears', () => {
    const node = stackNode('a')
    syncExpandWithSelection(['a'], [node])
    syncExpandWithSelection([], [node])
    expect(getExpanded('a')).toBeUndefined()
  })

  it('collapses previous node when selection moves', () => {
    const a = stackNode('a')
    const b = stackNode('b')
    syncExpandWithSelection(['a'], [a, b])
    syncExpandWithSelection(['b'], [a, b])
    expect(getExpanded('a')).toBeUndefined()
    expect(getExpanded('b')).toBe(true)
  })

  it('clears manual override on deselect', () => {
    const node = stackNode('a')
    setExpanded('a', false)
    syncExpandWithSelection(['a'], [node])
    expect(getExpanded('a')).toBe(true)
    syncExpandWithSelection([], [node])
    expect(getExpanded('a')).toBeUndefined()
  })

  it('collapses on multi-select', () => {
    const a = stackNode('a')
    const b = stackNode('b')
    syncExpandWithSelection(['a'], [a, b])
    syncExpandWithSelection(['a', 'b'], [a, b])
    expect(getExpanded('a')).toBeUndefined()
  })
})

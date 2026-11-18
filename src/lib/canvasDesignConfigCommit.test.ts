import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { enrichCanvasDesignPatch } from './canvasDesignConfigCommit'

const limits = { maxAppReplicas: 5 }

function computeNode(replicas = 1): CanvasNode {
  return {
    id: 'app',
    type: 'compute',
    label: 'App Server',
    x: 0,
    y: 0,
    z: 0,
    position: [0, 0, 0],
    config: { replicas, instanceSize: 'small', instanceSizes: ['small'] },
  }
}

describe('enrichCanvasDesignPatch', () => {
  it('clamps replicas and expands instanceSizes', () => {
    const node = computeNode(1)
    const patch = enrichCanvasDesignPatch(node, { replicas: 3 }, limits)
    expect(patch.replicas).toBe(3)
    expect(patch.instanceSizes).toEqual(['small', 'small', 'small'])
  })

  it('syncs uniform size across copies', () => {
    const node = computeNode(2)
    node.config.replicas = 2
    node.config.instanceSizes = ['small', 'small']
    const patch = enrichCanvasDesignPatch(
      node,
      { instanceSize: 'medium', resourceProfile: 'medium' },
      limits,
    )
    expect(patch.instanceSizes).toEqual(['medium', 'medium'])
  })
})
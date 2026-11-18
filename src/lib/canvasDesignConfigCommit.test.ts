import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { enrichCanvasDesignPatch } from './canvasDesignConfigCommit'

const limits = { maxAppReplicas: 5 }

function computeNode(replicas = 1): CanvasNode {
  return {
    id: 'app',
    type: 'compute',
    label: 'App Server',
    position: [0, 0, 0],
    status: 'idle',
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

  it('stores a parseable autoscale range', () => {
    const node = computeNode(1)
    const patch = enrichCanvasDesignPatch(
      node,
      { autoscale: { min: 1, max: 5, targetCPUPercent: 70 } },
      limits,
    )
    expect(patch.autoscale).toEqual({ min: 1, max: 5, targetCPUPercent: 70 })
    expect(patch.instanceSizes).toEqual([
      'small',
      'small',
      'small',
      'small',
      'small',
    ])
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
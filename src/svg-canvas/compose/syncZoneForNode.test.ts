import { describe, expect, it } from 'vitest'
import { isoToScreen } from '../math/iso'
import {
  emptyConfig,
  type ReplicaPacking,
  type SvgNode,
} from '../store/svgTypes'
import { syncZoneForNode, unitObstacleAnchors } from './syncZoneForNode'

function node(
  replicas: number,
  packing: ReplicaPacking = 'stack',
): SvgNode {
  const p = isoToScreen(0.5, -0.5)
  return {
    id: 'n1',
    archetype: 'app-server',
    x: p.x,
    y: p.y,
    label: 'T2',
    config: emptyConfig(),
    topology: { replicas, shards: 1, packing },
  }
}

describe('syncZoneForNode', () => {
  it('returns null when replicas is 1', () => {
    expect(syncZoneForNode(node(1))).toBeNull()
  })

  it('returns null for collapsed stack even when replicas > 1', () => {
    expect(syncZoneForNode(node(3, 'stack'))).toBeNull()
  })

  it('returns a zone when packing is fan and replicas > 1', () => {
    const z = syncZoneForNode(node(3, 'fan'))
    expect(z).not.toBeNull()
    expect(z!.ownerNodeId).toBe('n1')
    expect(z!.label).toBe('×3')
    expect(z!.cols).toBeGreaterThanOrEqual(1)
    expect(z!.rows).toBeGreaterThanOrEqual(1)
  })

  it('emits one obstacle anchor per unit (capped at platform max)', () => {
    expect(unitObstacleAnchors(node(1))).toHaveLength(1)
    expect(unitObstacleAnchors(node(3))).toHaveLength(3)
    expect(unitObstacleAnchors(node(9))).toHaveLength(3)
  })
})
